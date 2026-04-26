'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Typography,
  Paper,
  CircularProgress,
  Chip,
  Avatar,
  Fade
} from '@mui/material';
import {
  Send,
  SmartToy,
  Person
} from '@mui/icons-material';

const QUICK_PROMPTS = [
  'ปลาอะไรจับได้บ่อยที่สุด',
  'มีปลาหายากอะไรบ้าง',
  'ตะเพียนคืออะไร',
  'แม่น้ำโขงมีปลากี่ชนิด',
  'ปลาอะไรมีมูลค่ามากที่สุด'
];

export default function ChatInterface({ placeholder = 'ถามเกี่ยวกับปลาแม่น้ำโขง...', compact = false }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (messageText = input) => {
    if (!messageText.trim() || loading) return;

    const userMessage = messageText.trim();
    setInput('');

    // เพิ่มข้อความของ user
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      });

      const data = await response.json();

      if (data.success || data.answer) {
        // เพิ่มคำตอบจาก AI
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: data.answer,
            context: data.context
          }
        ]);
      } else {
        // เพิ่มข้อความ error
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: data.answer || data.error || 'ขออภัยครับ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
            error: true
          }
        ]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'ขออภัยครับ ไม่สามารถเชื่อมต่อกับระบบ AI ได้ กรุณาลองใหม่อีกครั้ง',
          error: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPrompt = (prompt) => {
    handleSend(prompt);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: compact ? '400px' : '500px',
        bgcolor: 'background.paper',
        borderRadius: 2,
        overflow: 'hidden'
      }}
    >
      {/* Messages Area */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}
      >
        {messages.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <SmartToy sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              🐟 ถามเกี่ยวกับปลาแม่น้ำโขง
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              ฉันสามารถตอบคำถามเกี่ยวกับชนิดปลา สถิติการจับปลา และข้อมูลแม่น้ำโขง
            </Typography>

            {/* Quick Prompts */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
              {QUICK_PROMPTS.map((prompt, idx) => (
                <Chip
                  key={idx}
                  label={prompt}
                  onClick={() => handleQuickPrompt(prompt)}
                  size="small"
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Box>
          </Box>
        )}

        {messages.map((msg, idx) => (
          <Fade key={idx} in={true}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                gap: 1
              }}
            >
              {msg.role === 'assistant' && (
                <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                  <SmartToy sx={{ fontSize: 20 }} />
                </Avatar>
              )}

              <Paper
                elevation={1}
                sx={{
                  p: 1.5,
                  maxWidth: '70%',
                  bgcolor: msg.role === 'user' ? 'primary.main' : msg.error ? 'error.light' : 'grey.100',
                  color: msg.role === 'user' ? 'white' : 'text.primary'
                }}
              >
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {msg.content}
                </Typography>
              </Paper>

              {msg.role === 'user' && (
                <Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32 }}>
                  <Person sx={{ fontSize: 20 }} />
                </Avatar>
              )}
            </Box>
          </Fade>
        ))}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', gap: 1 }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
              <SmartToy sx={{ fontSize: 20 }} />
            </Avatar>
            <Paper elevation={1} sx={{ p: 1.5, bgcolor: 'grey.100' }}>
              <CircularProgress size={20} />
              <Typography variant="caption" sx={{ ml: 1 }}>
                กำลังคิด...
              </Typography>
            </Paper>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Box>

      {/* Input Area */}
      <Box
        sx={{
          p: 2,
          bgcolor: 'grey.50',
          borderTop: 1,
          borderColor: 'divider'
        }}
      >
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder={placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={loading}
            multiline
            maxRows={3}
          />
          <IconButton
            color="primary"
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            sx={{
              bgcolor: 'primary.main',
              color: 'white',
              '&:hover': { bgcolor: 'primary.dark' },
              '&:disabled': { bgcolor: 'grey.300' }
            }}
          >
            <Send />
          </IconButton>
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          💡 ลอง: {QUICK_PROMPTS[Math.floor(Math.random() * QUICK_PROMPTS.length)]}
        </Typography>
      </Box>
    </Box>
  );
}
