'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Box, Typography, Paper, Grid, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Button, Chip, Alert, Divider,
  ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import { BarChart, Download, Science, ContentCopy } from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { CATEGORY_LABELS } from '@/lib/evaluationQuestions';
import { mean, stddev, pairedTTest, scoreDistribution } from '@/lib/research-stats';

const CATEGORY_COLORS = { A: 'primary', B: 'success', C: 'info', D: 'warning' };

export default function ResultsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('overall');

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'evaluationResults'));
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setRows(data);
      } catch (err) {
        console.error('Failed to load evaluationResults:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats = useMemo(() => computeStats(rows), [rows]);
  const perCategory = useMemo(() => computePerCategory(rows), [rows]);
  const perDifficulty = useMemo(() => computePerDifficulty(rows), [rows]);
  const latex = useMemo(() => buildLatex(stats, perCategory, perDifficulty), [stats, perCategory, perDifficulty]);

  const copyLatex = () => {
    navigator.clipboard.writeText(latex).then(
      () => console.log('LaTeX copied'),
      err => console.error('copy failed', err),
    );
  };

  const downloadLatex = () => {
    const blob = new Blob([latex], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'results_tables.tex'; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <Box p={3}><Typography>กำลังโหลดผลการประเมิน…</Typography></Box>
      </DashboardLayout>
    );
  }

  if (rows.length === 0) {
    return (
      <DashboardLayout>
        <Box p={3}>
          <Alert severity="info">ยังไม่มีผลใน <b>evaluationResults</b> — ไปทำการประเมินที่หน้า /research/evaluation ก่อน</Alert>
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BarChart color="primary" />
            <Typography variant="h5" fontWeight="bold">ผลการเปรียบเทียบ RAG vs Baseline</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" size="small" startIcon={<ContentCopy />} onClick={copyLatex}>Copy LaTeX</Button>
            <Button variant="contained" size="small" startIcon={<Download />} onClick={downloadLatex}>Download .tex</Button>
          </Box>
        </Box>

        <ToggleButtonGroup value={view} exclusive size="small" sx={{ mb: 3 }} onChange={(_, v) => v && setView(v)}>
          <ToggleButton value="overall">ภาพรวม</ToggleButton>
          <ToggleButton value="category">แยกตามหมวด</ToggleButton>
          <ToggleButton value="difficulty">แยกตามระดับความยาก</ToggleButton>
          <ToggleButton value="latex">LaTeX preview</ToggleButton>
        </ToggleButtonGroup>

        {view === 'overall' && <OverallView stats={stats} n={rows.length} />}
        {view === 'category' && <CategoryView data={perCategory} />}
        {view === 'difficulty' && <DifficultyView data={perDifficulty} />}
        {view === 'latex' && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              คัดลอกไปวางใน paper (LaTeX/Overleaf)
            </Typography>
            <Box component="pre" sx={{ p: 2, bgcolor: 'grey.100', overflow: 'auto', fontSize: '0.75rem', borderRadius: 1 }}>
              {latex}
            </Box>
          </Paper>
        )}
      </Box>
    </DashboardLayout>
  );
}

// ── Sub-views ───────────────────────────────────────────────

function OverallView({ stats, n }) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Alert severity={stats.tTestScore.p < 0.05 ? 'success' : 'warning'} sx={{ mb: 2 }}>
          <strong>Paired t-test (RAG vs Baseline, human score):</strong>{' '}
          t({stats.tTestScore.df}) = {stats.tTestScore.t.toFixed(3)}, p = {stats.tTestScore.p.toExponential(3)}
          {stats.tTestScore.p < 0.05
            ? ' — ปฏิเสธสมมุติฐานหลัก: RAG ต่างจาก baseline อย่างมีนัยสำคัญ'
            : ' — ยังไม่มีนัยสำคัญที่ระดับ α=0.05 (อาจต้องเพิ่มขนาดตัวอย่างหรือปรับ retriever)'}
        </Alert>
      </Grid>
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>คะแนนจากผู้ประเมิน (0/1/2)</Typography>
          <StatsBlock label="Baseline (Cond A)" m={stats.condA.mean} sd={stats.condA.sd} n={n} dist={stats.condA.dist} />
          <Divider sx={{ my: 1 }} />
          <StatsBlock label="RAG (Cond B)" m={stats.condB.mean} sd={stats.condB.sd} n={n} dist={stats.condB.dist} highlight />
        </Paper>
      </Grid>
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>Faithfulness / Groundedness (0..1)</Typography>
          <StatsBlock label="Baseline (Cond A)" m={stats.faithA.mean} sd={stats.faithA.sd} n={stats.faithA.n} />
          <Divider sx={{ my: 1 }} />
          <StatsBlock label="RAG (Cond B)" m={stats.faithB.mean} sd={stats.faithB.sd} n={stats.faithB.n} highlight />
          {stats.tTestFaith.n > 1 && (
            <Typography variant="caption" color="text.secondary" mt={1} display="block">
              Paired t: t({stats.tTestFaith.df}) = {stats.tTestFaith.t.toFixed(3)}, p = {stats.tTestFaith.p.toExponential(3)}
            </Typography>
          )}
        </Paper>
      </Grid>
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>Response time (ms)</Typography>
          <StatsBlock label="Baseline" m={stats.timeA.mean} sd={stats.timeA.sd} n={stats.timeA.n} unit="ms" />
          <Divider sx={{ my: 1 }} />
          <StatsBlock label="RAG" m={stats.timeB.mean} sd={stats.timeB.sd} n={stats.timeB.n} unit="ms" />
        </Paper>
      </Grid>
    </Grid>
  );
}

function StatsBlock({ label, m, sd, n, dist, unit = '', highlight = false }) {
  return (
    <Box>
      <Typography variant="body2" color={highlight ? 'primary.main' : 'text.primary'} fontWeight={highlight ? 700 : 500}>
        {label}
      </Typography>
      <Typography variant="h5" fontWeight="bold">
        {m.toFixed(3)}{unit && ` ${unit}`}
        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
          ± {sd.toFixed(3)} (n={n})
        </Typography>
      </Typography>
      {dist && (
        <Typography variant="caption" color="text.secondary">
          กระจาย: Correct={dist[2]}, Partial={dist[1]}, Wrong={dist[0]}
        </Typography>
      )}
    </Box>
  );
}

function CategoryView({ data }) {
  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: 'grey.50' }}>
            <TableCell>หมวด</TableCell>
            <TableCell align="center">n</TableCell>
            <TableCell align="center">Baseline mean</TableCell>
            <TableCell align="center">RAG mean</TableCell>
            <TableCell align="center">Δ</TableCell>
            <TableCell align="center">p (paired t)</TableCell>
            <TableCell align="center">Faith A</TableCell>
            <TableCell align="center">Faith B</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map(row => (
            <TableRow key={row.cat}>
              <TableCell><Chip label={`${row.cat}: ${row.label}`} size="small" color={CATEGORY_COLORS[row.cat]} /></TableCell>
              <TableCell align="center">{row.n}</TableCell>
              <TableCell align="center">{row.condA_mean.toFixed(2)}</TableCell>
              <TableCell align="center"><b>{row.condB_mean.toFixed(2)}</b></TableCell>
              <TableCell align="center" sx={{ color: row.delta >= 0 ? 'success.main' : 'error.main', fontWeight: 700 }}>
                {row.delta >= 0 ? '+' : ''}{row.delta.toFixed(2)}
              </TableCell>
              <TableCell align="center" sx={{ color: row.p < 0.05 ? 'success.main' : 'text.primary' }}>
                {row.p.toExponential(2)}{row.p < 0.05 ? ' *' : ''}
              </TableCell>
              <TableCell align="center">{row.faith_a.toFixed(2)}</TableCell>
              <TableCell align="center"><b>{row.faith_b.toFixed(2)}</b></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function DifficultyView({ data }) {
  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: 'grey.50' }}>
            <TableCell>ระดับ</TableCell>
            <TableCell align="center">n</TableCell>
            <TableCell align="center">Baseline</TableCell>
            <TableCell align="center">RAG</TableCell>
            <TableCell align="center">Δ</TableCell>
            <TableCell align="center">p</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map(row => (
            <TableRow key={row.difficulty}>
              <TableCell>{row.difficulty}</TableCell>
              <TableCell align="center">{row.n}</TableCell>
              <TableCell align="center">{row.condA_mean.toFixed(2)}</TableCell>
              <TableCell align="center"><b>{row.condB_mean.toFixed(2)}</b></TableCell>
              <TableCell align="center" sx={{ color: row.delta >= 0 ? 'success.main' : 'error.main' }}>
                {row.delta >= 0 ? '+' : ''}{row.delta.toFixed(2)}
              </TableCell>
              <TableCell align="center" sx={{ color: row.p < 0.05 ? 'success.main' : 'text.primary' }}>
                {row.p.toExponential(2)}{row.p < 0.05 ? ' *' : ''}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ── Stats compute ───────────────────────────────────────────

function computeStats(rows) {
  const scoresA = rows.map(r => r.condA_score).filter(v => typeof v === 'number');
  const scoresB = rows.map(r => r.condB_score).filter(v => typeof v === 'number');
  const faithA = rows.map(r => r.condA_faithfulness).filter(v => typeof v === 'number');
  const faithB = rows.map(r => r.condB_faithfulness).filter(v => typeof v === 'number');
  const timeA = rows.map(r => r.condA_response_ms).filter(v => typeof v === 'number');
  const timeB = rows.map(r => r.condB_response_ms).filter(v => typeof v === 'number');

  const pairedScore = pairRows(rows, 'condA_score', 'condB_score');
  const pairedFaith = pairRows(rows, 'condA_faithfulness', 'condB_faithfulness');

  return {
    condA: { mean: mean(scoresA), sd: stddev(scoresA), dist: scoreDistribution(scoresA) },
    condB: { mean: mean(scoresB), sd: stddev(scoresB), dist: scoreDistribution(scoresB) },
    faithA: { mean: mean(faithA), sd: stddev(faithA), n: faithA.length },
    faithB: { mean: mean(faithB), sd: stddev(faithB), n: faithB.length },
    timeA: { mean: mean(timeA), sd: stddev(timeA), n: timeA.length },
    timeB: { mean: mean(timeB), sd: stddev(timeB), n: timeB.length },
    tTestScore: pairedScore.length > 1 ? pairedTTest(pairedScore.map(p => p[1]), pairedScore.map(p => p[0])) : emptyTTest(),
    tTestFaith: pairedFaith.length > 1 ? pairedTTest(pairedFaith.map(p => p[1]), pairedFaith.map(p => p[0])) : emptyTTest(),
  };
}

function emptyTTest() { return { t: 0, df: 0, p: 1, meanDiff: 0, sdDiff: 0, n: 0 }; }

function pairRows(rows, fieldA, fieldB) {
  return rows
    .map(r => [r[fieldA], r[fieldB]])
    .filter(([a, b]) => typeof a === 'number' && typeof b === 'number');
}

function computePerCategory(rows) {
  const cats = ['A', 'B', 'C', 'D'];
  return cats.map(cat => {
    const catRows = rows.filter(r => r.category === cat);
    const pairs = pairRows(catRows, 'condA_score', 'condB_score');
    const a = pairs.map(p => p[0]);
    const b = pairs.map(p => p[1]);
    const faithA = catRows.map(r => r.condA_faithfulness).filter(v => typeof v === 'number');
    const faithB = catRows.map(r => r.condB_faithfulness).filter(v => typeof v === 'number');
    return {
      cat,
      label: CATEGORY_LABELS[cat],
      n: pairs.length,
      condA_mean: mean(a),
      condB_mean: mean(b),
      delta: mean(b) - mean(a),
      p: pairs.length > 1 ? pairedTTest(b, a).p : 1,
      faith_a: mean(faithA),
      faith_b: mean(faithB),
    };
  });
}

function computePerDifficulty(rows) {
  const levels = ['easy', 'medium', 'hard'];
  return levels.map(level => {
    const dRows = rows.filter(r => r.difficulty === level);
    const pairs = pairRows(dRows, 'condA_score', 'condB_score');
    const a = pairs.map(p => p[0]);
    const b = pairs.map(p => p[1]);
    return {
      difficulty: level,
      n: pairs.length,
      condA_mean: mean(a),
      condB_mean: mean(b),
      delta: mean(b) - mean(a),
      p: pairs.length > 1 ? pairedTTest(b, a).p : 1,
    };
  });
}

// ── LaTeX export ────────────────────────────────────────────

function buildLatex(stats, byCat, byDiff) {
  const escNum = v => Number.isFinite(v) ? v.toFixed(3) : '-';
  const escP = v => Number.isFinite(v) ? (v < 0.001 ? '<0.001' : v.toFixed(3)) : '-';

  return `%% Auto-generated by /research/results — copy into paper.
%% Requires \\usepackage{booktabs}

\\begin{table}[t]
  \\centering
  \\caption{Overall comparison between RAG (B) and baseline LLM (A) on 60-question Mekong fish biodiversity benchmark.}
  \\label{tab:overall}
  \\begin{tabular}{lcccc}
    \\toprule
    Condition & Mean score & SD & Faithfulness & Response time (ms) \\\\
    \\midrule
    Baseline (A) & ${escNum(stats.condA.mean)} & ${escNum(stats.condA.sd)} & ${escNum(stats.faithA.mean)} & ${escNum(stats.timeA.mean)} \\\\
    RAG (B)      & ${escNum(stats.condB.mean)} & ${escNum(stats.condB.sd)} & ${escNum(stats.faithB.mean)} & ${escNum(stats.timeB.mean)} \\\\
    \\midrule
    $\\Delta$    & ${escNum(stats.condB.mean - stats.condA.mean)} & — & ${escNum(stats.faithB.mean - stats.faithA.mean)} & ${escNum(stats.timeB.mean - stats.timeA.mean)} \\\\
    \\bottomrule
  \\end{tabular}
  \\vspace{2pt}
  \\footnotesize{Paired t-test on scores: $t(${stats.tTestScore.df}) = ${escNum(stats.tTestScore.t)}$, $p = ${escP(stats.tTestScore.p)}$.}
\\end{table}

\\begin{table}[t]
  \\centering
  \\caption{Per-category breakdown. * denotes $p < 0.05$.}
  \\label{tab:by-category}
  \\begin{tabular}{lccccc}
    \\toprule
    Category & $n$ & Baseline & RAG & $\\Delta$ & $p$ \\\\
    \\midrule
${byCat.map(r => `    ${r.cat}. ${r.label} & ${r.n} & ${escNum(r.condA_mean)} & ${escNum(r.condB_mean)} & ${escNum(r.delta)} & ${escP(r.p)}${r.p < 0.05 ? '*' : ''} \\\\`).join('\n')}
    \\bottomrule
  \\end{tabular}
\\end{table}

\\begin{table}[t]
  \\centering
  \\caption{Breakdown by difficulty.}
  \\label{tab:by-difficulty}
  \\begin{tabular}{lccccc}
    \\toprule
    Difficulty & $n$ & Baseline & RAG & $\\Delta$ & $p$ \\\\
    \\midrule
${byDiff.map(r => `    ${r.difficulty} & ${r.n} & ${escNum(r.condA_mean)} & ${escNum(r.condB_mean)} & ${escNum(r.delta)} & ${escP(r.p)}${r.p < 0.05 ? '*' : ''} \\\\`).join('\n')}
    \\bottomrule
  \\end{tabular}
\\end{table}
`;
}
