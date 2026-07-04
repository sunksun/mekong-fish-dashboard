'use client';

import { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Paper, Chip, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions,
  ToggleButton, ToggleButtonGroup, Alert, Divider, LinearProgress,
  Card, CardContent, Grid, Tooltip
} from '@mui/material';
import {
  Science, Download, Send, CheckCircle, RadioButtonUnchecked,
  CompareArrows, BarChart
} from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { QUESTION_SET, CATEGORY_LABELS, SCORE_LABELS } from '@/lib/evaluationQuestions';

const CATEGORY_COLORS = { A: 'primary', B: 'success', C: 'info', D: 'warning' };

function FaithfulnessBadge({ value }) {
  if (!value) return <Typography variant="caption" color="text.disabled">Faithfulness: — (กำลังคำนวณ)</Typography>;
  const g = value.groundedness;
  const color = g >= 0.8 ? 'success.main' : g >= 0.5 ? 'warning.main' : 'error.main';
  return (
    <Typography variant="caption" component="div" sx={{ color, fontWeight: 600 }}>
      Faithfulness: {(g * 100).toFixed(0)}% ({value.n_supported}/{value.n_claims} claims supported)
    </Typography>
  );
}

function TimingBadge({ value }) {
  if (!value) return null;
  const parts = [];
  if (value.retrieval_ms != null) parts.push(`retrieval ${value.retrieval_ms}ms`);
  if (value.generation_ms != null) parts.push(`gen ${value.generation_ms}ms`);
  parts.push(`total ${value.total_ms}ms`);
  return <Typography variant="caption" color="text.secondary" component="div">⏱ {parts.join(' · ')}</Typography>;
}

function ScoreButtons({ questionId, condition, onScore, value }) {
  return (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      {[2, 1, 0].map(score => (
        <Button key={score} size="small" variant={value === score ? 'contained' : 'outlined'}
          color={score === 2 ? 'success' : score === 1 ? 'warning' : 'error'}
          onClick={() => onScore(questionId, condition, score)}
          sx={{ minWidth: 36, px: 1, fontSize: '0.75rem' }}
        >
          {SCORE_LABELS[score].split(' ')[0]}
        </Button>
      ))}
    </Box>
  );
}

export default function EvaluationPage() {
  const { userProfile } = useAuth();
  const [selectedQ, setSelectedQ] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [answers, setAnswers] = useState({}); // { [questionId]: { condA: str, condB: str, scoreA: null, scoreB: null, loading: false } }
  const [savedResults, setSavedResults] = useState({}); // { [questionId]: true }
  const [loadingAll, setLoadingAll] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  // โหลด results ที่บันทึกไว้แล้ว
  useEffect(() => {
    const loadSaved = async () => {
      try {
        const snap = await getDocs(collection(db, 'evaluationResults'));
        const saved = {};
        snap.forEach(doc => { saved[doc.data().questionId] = true; });
        setSavedResults(saved);
      } catch (e) {
        console.error('Load saved results:', e);
      }
    };
    loadSaved();
  }, []);

  const filteredQuestions = categoryFilter === 'ALL'
    ? QUESTION_SET
    : QUESTION_SET.filter(q => q.category === categoryFilter);

  const answeredCount = Object.values(answers).filter(a => a.condA && a.condB).length;
  const scoredCount = Object.values(answers).filter(a => a.scoreA !== null && a.scoreB !== null).length;

  // ส่งคำถามไปทั้ง 2 conditions พร้อมกัน + คำนวณ faithfulness อัตโนมัติ
  const sendQuestion = async (q) => {
    setAnswers(prev => ({
      ...prev,
      [q.id]: {
        ...prev[q.id],
        condA: '', condB: '', scoreA: null, scoreB: null,
        retrievedB: [], timingA: null, timingB: null,
        faithA: null, faithB: null,
        loading: true,
      }
    }));
    try {
      const [resA, resB] = await Promise.all([
        fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: q.question, mode: 'no-rag' }) }),
        fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: q.question, mode: 'rag' }) })
      ]);
      const [dataA, dataB] = await Promise.all([resA.json(), resB.json()]);
      const retrievedB = dataB.context?.retrieved || [];

      setAnswers(prev => ({
        ...prev,
        [q.id]: {
          condA: dataA.answer || 'เกิดข้อผิดพลาด',
          condB: dataB.answer || 'เกิดข้อผิดพลาด',
          scoreA: null, scoreB: null,
          retrievedB,
          timingA: dataA.context?.timing || null,
          timingB: dataB.context?.timing || null,
          faithA: null, faithB: null,
          loading: false,
        }
      }));

      // Auto-score faithfulness in the background (best effort — errors don't block eval)
      scoreFaithfulnessFor(q.id, dataA.answer, [], 'A');
      scoreFaithfulnessFor(q.id, dataB.answer, retrievedB, 'B');
    } catch (e) {
      setAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], loading: false, condA: 'เกิดข้อผิดพลาด', condB: 'เกิดข้อผิดพลาด' } }));
    }
  };

  const scoreFaithfulnessFor = async (questionId, answer, chunks, cond) => {
    if (!answer) return;
    try {
      const res = await fetch('/api/research/faithfulness', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer, chunks: chunks.map(c => ({ text: c.preview || c.text || '' })) }),
      });
      const data = await res.json();
      if (!data.success) return;
      setAnswers(prev => ({
        ...prev,
        [questionId]: {
          ...prev[questionId],
          [cond === 'A' ? 'faithA' : 'faithB']: {
            groundedness: data.groundedness,
            n_claims: data.n_claims,
            n_supported: data.n_supported,
          }
        }
      }));
    } catch (err) {
      console.warn('faithfulness scoring failed:', err);
    }
  };

  const sendAll = async () => {
    setLoadingAll(true);
    const pending = filteredQuestions.filter(q => !answers[q.id]?.condA);
    for (const q of pending) {
      await sendQuestion(q);
    }
    setLoadingAll(false);
  };

  const setScore = (questionId, condition, score) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], [condition === 'A' ? 'scoreA' : 'scoreB']: score }
    }));
  };

  const saveResult = async (q) => {
    const ans = answers[q.id];
    if (!ans || ans.scoreA === null || ans.scoreB === null) return;
    try {
      await addDoc(collection(db, 'evaluationResults'), {
        questionId: q.id,
        category: q.category,
        difficulty: q.difficulty,
        question: q.question,
        goldAnswer: q.goldAnswer,
        condA_answer: ans.condA,
        condB_answer: ans.condB,
        condA_score: ans.scoreA,
        condB_score: ans.scoreB,
        condA_faithfulness: ans.faithA?.groundedness ?? null,
        condB_faithfulness: ans.faithB?.groundedness ?? null,
        condA_n_claims: ans.faithA?.n_claims ?? null,
        condB_n_claims: ans.faithB?.n_claims ?? null,
        condA_response_ms: ans.timingA?.total_ms ?? null,
        condB_response_ms: ans.timingB?.total_ms ?? null,
        condB_retrieved_ids: (ans.retrievedB || []).map(c => c.id),
        condB_retrieval_ms: ans.timingB?.retrieval_ms ?? null,
        evaluatorId: userProfile?.uid || userProfile?.id || 'unknown',
        evaluatorName: userProfile?.name || userProfile?.email || 'unknown',
        timestamp: new Date()
      });
      setSavedResults(prev => ({ ...prev, [q.id]: true }));
    } catch (e) {
      console.error('Save result error:', e);
    }
  };

  // Export CSV — includes faithfulness + retrieval trace for paper analysis
  const exportCSV = async () => {
    const snap = await getDocs(collection(db, 'evaluationResults'));
    const rows = [[
      'questionId', 'category', 'difficulty', 'question', 'goldAnswer',
      'condA_answer', 'condB_answer', 'condA_score', 'condB_score',
      'condA_faithfulness', 'condB_faithfulness',
      'condA_n_claims', 'condB_n_claims',
      'condA_response_ms', 'condB_response_ms',
      'condB_retrieved_ids', 'condB_retrieval_ms',
      'evaluatorName', 'timestamp',
    ]];
    const esc = v => v == null ? '' : `"${String(v).replace(/"/g, '""')}"`;
    snap.forEach(doc => {
      const d = doc.data();
      rows.push([
        d.questionId, d.category, d.difficulty, esc(d.question), esc(d.goldAnswer),
        esc(d.condA_answer), esc(d.condB_answer), d.condA_score, d.condB_score,
        d.condA_faithfulness ?? '', d.condB_faithfulness ?? '',
        d.condA_n_claims ?? '', d.condB_n_claims ?? '',
        d.condA_response_ms ?? '', d.condB_response_ms ?? '',
        esc((d.condB_retrieved_ids || []).join('|')), d.condB_retrieval_ms ?? '',
        esc(d.evaluatorName), d.timestamp?.toDate?.()?.toISOString() || '',
      ]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'evaluation_results.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // Summary stats
  const getSummary = () => {
    const saved = Object.entries(savedResults).filter(([, v]) => v).map(([id]) => id);
    const cats = ['A', 'B', 'C', 'D'];
    return cats.map(cat => {
      const qs = QUESTION_SET.filter(q => q.category === cat && answers[q.id]?.scoreA !== null && answers[q.id]?.scoreB !== null);
      const totalPossible = qs.length * 2;
      const scoreA = qs.reduce((s, q) => s + (answers[q.id]?.scoreA || 0), 0);
      const scoreB = qs.reduce((s, q) => s + (answers[q.id]?.scoreB || 0), 0);
      const accA = totalPossible ? (scoreA / totalPossible * 100).toFixed(1) : '-';
      const accB = totalPossible ? (scoreB / totalPossible * 100).toFixed(1) : '-';
      return { cat, label: CATEGORY_LABELS[cat], count: qs.length, accA, accB };
    });
  };


  return (
    <DashboardLayout>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Science color="primary" />
              <Typography variant="h5" fontWeight="bold">RAG Evaluation</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              เปรียบเทียบ Condition A (Gemini ล้วน) vs Condition B (RAG) — Question Set {QUESTION_SET.length} ข้อ
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" startIcon={<BarChart />} onClick={() => setSummaryOpen(true)} size="small">
              สรุปผล
            </Button>
            <Button variant="outlined" startIcon={<Download />} onClick={exportCSV} size="small">
              Export CSV
            </Button>
          </Box>
        </Box>

        {/* Progress */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4}>
              <Typography variant="body2" color="text.secondary">คำถามที่ส่งแล้ว</Typography>
              <Typography variant="h6" fontWeight="bold">{answeredCount} / {QUESTION_SET.length}</Typography>
              <LinearProgress variant="determinate" value={answeredCount / QUESTION_SET.length * 100} sx={{ mt: 0.5 }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="body2" color="text.secondary">ให้คะแนนครบแล้ว</Typography>
              <Typography variant="h6" fontWeight="bold" color="success.main">{scoredCount} / {QUESTION_SET.length}</Typography>
              <LinearProgress variant="determinate" value={scoredCount / QUESTION_SET.length * 100} color="success" sx={{ mt: 0.5 }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="body2" color="text.secondary">บันทึกแล้ว</Typography>
              <Typography variant="h6" fontWeight="bold" color="info.main">{Object.keys(savedResults).length} / {QUESTION_SET.length}</Typography>
              <LinearProgress variant="determinate" value={Object.keys(savedResults).length / QUESTION_SET.length * 100} color="info" sx={{ mt: 0.5 }} />
            </Grid>
          </Grid>
        </Paper>

        {/* Filters + Send All */}
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
          <ToggleButtonGroup value={categoryFilter} exclusive onChange={(_, v) => v && setCategoryFilter(v)} size="small">
            <ToggleButton value="ALL">ทั้งหมด</ToggleButton>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <ToggleButton key={k} value={k}>{k}: {v}</ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Button variant="contained" startIcon={loadingAll ? <CircularProgress size={16} color="inherit" /> : <Send />}
            onClick={sendAll} disabled={loadingAll} size="small">
            ส่งทั้งหมดที่กรอง ({filteredQuestions.filter(q => !answers[q.id]?.condA).length} ข้อที่ยังไม่ส่ง)
          </Button>
        </Box>

        {/* Question Table */}
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={{ width: 60 }}>รหัส</TableCell>
                <TableCell sx={{ width: 80 }}>หมวด</TableCell>
                <TableCell>คำถาม</TableCell>
                <TableCell sx={{ width: 80 }}>ระดับ</TableCell>
                <TableCell sx={{ width: 80 }} align="center">สถานะ</TableCell>
                <TableCell sx={{ width: 100 }} align="center">การดำเนินการ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredQuestions.map(q => {
                const ans = answers[q.id];
                const isSaved = savedResults[q.id];
                const hasAnswer = ans?.condA && ans?.condB;
                const isScored = ans?.scoreA !== null && ans?.scoreB !== null;
                return (
                  <TableRow key={q.id} hover sx={{ cursor: 'pointer', bgcolor: isSaved ? 'success.50' : undefined }}
                    onClick={() => setSelectedQ(q)}>
                    <TableCell><Typography variant="caption" fontWeight="bold">{q.id}</Typography></TableCell>
                    <TableCell>
                      <Chip label={q.category} size="small" color={CATEGORY_COLORS[q.category]} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {q.question || <Typography component="span" color="text.disabled" fontSize="0.8rem">— ยังไม่กรอกคำถาม —</Typography>}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={q.difficulty} size="small" variant="outlined"
                        color={q.difficulty === 'easy' ? 'success' : q.difficulty === 'medium' ? 'warning' : 'error'} />
                    </TableCell>
                    <TableCell align="center">
                      {isSaved ? <Tooltip title="บันทึกแล้ว"><CheckCircle fontSize="small" color="success" /></Tooltip>
                        : isScored ? <Chip label="ให้คะแนนแล้ว" size="small" color="warning" />
                        : hasAnswer ? <Chip label="รอให้คะแนน" size="small" color="info" />
                        : ans?.loading ? <CircularProgress size={16} />
                        : <RadioButtonUnchecked fontSize="small" color="disabled" />}
                    </TableCell>
                    <TableCell align="center" onClick={e => e.stopPropagation()}>
                      <Button size="small" variant="outlined" startIcon={<Send />}
                        disabled={ans?.loading || !q.question}
                        onClick={() => sendQuestion(q)}
                        sx={{ fontSize: '0.7rem', minWidth: 80 }}
                      >
                        {ans?.loading ? 'กำลังส่ง...' : 'ส่ง'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Question Detail Dialog */}
        {selectedQ && (
          <Dialog open={!!selectedQ} onClose={() => setSelectedQ(null)} maxWidth="lg" fullWidth scroll="paper">
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip label={selectedQ.id} color={CATEGORY_COLORS[selectedQ.category]} size="small" />
                <Typography fontWeight="bold">{CATEGORY_LABELS[selectedQ.category]}</Typography>
                <Chip label={selectedQ.difficulty} size="small" variant="outlined" />
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              {/* Question & Gold Answer */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>คำถาม</Typography>
                <Typography variant="body1" fontWeight="medium">{selectedQ.question || '— ยังไม่กรอกคำถาม —'}</Typography>
              </Box>
              <Box sx={{ bgcolor: '#e8f5e9', p: 2, borderRadius: 1, mb: 3, borderLeft: '4px solid #2e7d32' }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>Gold Answer (Condition C)</Typography>
                <Typography variant="body2">{selectedQ.goldAnswer || '— ยังไม่กรอก gold answer —'}</Typography>
              </Box>

              <Divider sx={{ mb: 3 }} />

              {/* Send button if not answered */}
              {!answers[selectedQ.id]?.condA && (
                <Box textAlign="center" mb={3}>
                  <Button variant="contained" startIcon={<Send />}
                    disabled={answers[selectedQ.id]?.loading || !selectedQ.question}
                    onClick={() => sendQuestion(selectedQ)}>
                    {answers[selectedQ.id]?.loading ? 'กำลังส่งคำถาม...' : 'ส่งคำถามไปทั้ง 2 เงื่อนไข'}
                  </Button>
                </Box>
              )}

              {answers[selectedQ.id]?.loading && (
                <Box textAlign="center" py={3}><CircularProgress /><Typography mt={1} color="text.secondary">กำลังรับคำตอบจาก AI...</Typography></Box>
              )}

              {/* Side-by-side answers */}
              {answers[selectedQ.id]?.condA && !answers[selectedQ.id]?.loading && (
                <Grid container spacing={2}>
                  {/* Condition A */}
                  <Grid item xs={12} md={6}>
                    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <Chip label="A" color="error" size="small" />
                        <Typography variant="subtitle2" fontWeight="bold">Gemini ล้วน (ไม่มี RAG)</Typography>
                      </Box>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, mb: 2, minHeight: 80 }}>
                        {answers[selectedQ.id].condA}
                      </Typography>
                      <FaithfulnessBadge value={answers[selectedQ.id].faithA} />
                      <TimingBadge value={answers[selectedQ.id].timingA} />
                      <Divider sx={{ mb: 1.5, mt: 1 }} />
                      <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                        ให้คะแนน: {SCORE_LABELS[answers[selectedQ.id].scoreA] ?? 'ยังไม่ให้คะแนน'}
                      </Typography>
                      <ScoreButtons questionId={selectedQ.id} condition="A" onScore={setScore} value={answers[selectedQ.id].scoreA} />
                    </Paper>
                  </Grid>

                  {/* Condition B */}
                  <Grid item xs={12} md={6}>
                    <Paper variant="outlined" sx={{ p: 2, height: '100%', borderColor: 'primary.main' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <Chip label="B" color="primary" size="small" />
                        <Typography variant="subtitle2" fontWeight="bold">Gemini + RAG (มี context)</Typography>
                      </Box>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, mb: 2, minHeight: 80 }}>
                        {answers[selectedQ.id].condB}
                      </Typography>
                      <FaithfulnessBadge value={answers[selectedQ.id].faithB} />
                      <TimingBadge value={answers[selectedQ.id].timingB} />
                      {answers[selectedQ.id].retrievedB?.length > 0 && (
                        <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={600}>
                            Retrieved chunks (top-{answers[selectedQ.id].retrievedB.length}):
                          </Typography>
                          {answers[selectedQ.id].retrievedB.map((c, i) => (
                            <Typography key={c.id} variant="caption" component="div" color="text.secondary" sx={{ mt: 0.3, fontSize: '0.7rem' }}>
                              [{i + 1}] {c.source} · {c.score.toFixed(3)} · {c.preview}…
                            </Typography>
                          ))}
                        </Box>
                      )}
                      <Divider sx={{ mb: 1.5, mt: 1 }} />
                      <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                        ให้คะแนน: {SCORE_LABELS[answers[selectedQ.id].scoreB] ?? 'ยังไม่ให้คะแนน'}
                      </Typography>
                      <ScoreButtons questionId={selectedQ.id} condition="B" onScore={setScore} value={answers[selectedQ.id].scoreB} />
                    </Paper>
                  </Grid>
                </Grid>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedQ(null)}>ปิด</Button>
              <Button variant="outlined" startIcon={<Send />}
                disabled={answers[selectedQ.id]?.loading || !selectedQ.question}
                onClick={() => sendQuestion(selectedQ)}>
                ส่งคำถามใหม่
              </Button>
              <Button variant="contained" color="success" startIcon={<CheckCircle />}
                disabled={!answers[selectedQ.id]?.condA || answers[selectedQ.id]?.scoreA === null || answers[selectedQ.id]?.scoreB === null || savedResults[selectedQ.id]}
                onClick={() => { saveResult(selectedQ); setSelectedQ(null); }}>
                {savedResults[selectedQ.id] ? 'บันทึกแล้ว' : 'บันทึกคะแนน'}
              </Button>
            </DialogActions>
          </Dialog>
        )}

        {/* Summary Dialog */}
        <Dialog open={summaryOpen} onClose={() => setSummaryOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>สรุปผลการประเมิน</DialogTitle>
          <DialogContent dividers>
            <Alert severity="info" sx={{ mb: 2 }}>แสดงเฉพาะข้อที่ให้คะแนนในหน้าต่างนี้แล้ว (ยังไม่ reload จาก Firestore)</Alert>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell>หมวด</TableCell>
                    <TableCell align="center">จำนวน</TableCell>
                    <TableCell align="center">Acc A (%)</TableCell>
                    <TableCell align="center">Acc B (%)</TableCell>
                    <TableCell align="center">+/−</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {getSummary().map(row => (
                    <TableRow key={row.cat}>
                      <TableCell><Chip label={`${row.cat}: ${row.label}`} size="small" color={CATEGORY_COLORS[row.cat]} /></TableCell>
                      <TableCell align="center">{row.count}</TableCell>
                      <TableCell align="center">{row.accA}</TableCell>
                      <TableCell align="center"><Typography fontWeight="bold" color="primary">{row.accB}</Typography></TableCell>
                      <TableCell align="center">
                        {row.accA !== '-' && row.accB !== '-' ? (
                          <Typography color={(parseFloat(row.accB) - parseFloat(row.accA)) >= 0 ? 'success.main' : 'error.main'} fontWeight="bold">
                            {(parseFloat(row.accB) - parseFloat(row.accA)) >= 0 ? '+' : ''}{(parseFloat(row.accB) - parseFloat(row.accA)).toFixed(1)}
                          </Typography>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSummaryOpen(false)}>ปิด</Button>
            <Button variant="contained" startIcon={<Download />} onClick={exportCSV}>Export CSV</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );

}
