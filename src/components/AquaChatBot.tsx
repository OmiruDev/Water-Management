import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, Sparkles, HelpCircle, CornerDownLeft } from 'lucide-react';
import type { ChatMessage, TelemetryReading } from '../types';

interface AquaChatBotProps {
  telemetry: TelemetryReading;
}

export const AquaChatBot: React.FC<AquaChatBotProps> = ({ telemetry }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_welcome',
      sender: 'assistant',
      text: `Hello! I'm AquaBot, your Smart Tank Assistant powered by Google AI Studio. The tank is currently at ${telemetry.waterPercentage}% (${telemetry.waterVolumeLiters.toLocaleString()} L) with the pump ${telemetry.pumpState}. Ask me anything about water usage, pump health, or refill schedules!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedQuestions: [
        'How much water did we use today?',
        'Is the pump behaving normally?',
        'When will the tank run dry?',
        'Are there any leaks detected?',
      ],
    },
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isSending) return;

    const userMessage: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery('');
    setIsSending(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend }),
      });

      const data = await response.json();
      if (data.success) {
        const botMessage: ChatMessage = {
          id: `bot_${Date.now()}`,
          sender: 'assistant',
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestedQuestions: data.suggestedQuestions,
        };
        setMessages((prev) => [...prev, botMessage]);
      } else {
        throw new Error(data.error || 'Failed to query assistant');
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        sender: 'assistant',
        text: "I'm currently having trouble retrieving telemetry data. Please ensure the server is running and try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div id="aqua-chat-bot-container" className="bg-slate-900/40 border border-slate-800 rounded-3xl shadow-[0_0_30px_rgba(15,23,42,0.4)] flex flex-col h-[420px] sm:h-[460px] overflow-hidden backdrop-blur-sm">
      {/* Header */}
      <div className="p-3.5 sm:p-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shadow-[0_0_12px_rgba(59,130,246,0.2)] shrink-0">
            <Bot className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-slate-100">AquaBot Assistant</h3>
              <span className="text-[9px] sm:text-[10px] font-mono bg-emerald-500/10 text-emerald-400 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                LIVE GROUNDED
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400">Natural language telemetry Q&A powered by Gemini</p>
          </div>
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3.5 sm:space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2.5 sm:gap-3 max-w-[90%] sm:max-w-[85%] ${
              msg.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
            }`}
          >
            {/* Avatar */}
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold border ${
                msg.sender === 'user'
                  ? 'bg-blue-600/30 border-blue-500/50 text-blue-300'
                  : 'bg-slate-800/80 border-slate-700 text-blue-400'
              }`}
            >
              {msg.sender === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>

            {/* Bubble */}
            <div className="space-y-1.5 sm:space-y-2 min-w-0">
              <div
                className={`p-3 sm:p-3.5 rounded-2xl text-xs leading-relaxed break-words ${
                  msg.sender === 'user'
                    ? 'bg-blue-600/20 border border-blue-500/40 text-blue-100 rounded-tr-xs shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                    : 'bg-slate-950/80 text-slate-200 rounded-tl-xs border border-slate-800 shadow-xs'
                }`}
              >
                <div className="whitespace-pre-line">{msg.text}</div>
                <div
                  className={`text-[9px] mt-1.5 text-right font-mono ${
                    msg.sender === 'user' ? 'text-blue-300/70' : 'text-slate-500'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>

              {/* Suggested Questions Chips */}
              {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {msg.suggestedQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(q)}
                      className="text-[10px] sm:text-[11px] font-medium bg-slate-950/60 hover:bg-blue-600/20 text-slate-300 hover:text-blue-300 border border-slate-800 hover:border-blue-500/50 px-2.5 py-1 rounded-full transition-all text-left flex items-center gap-1.5 cursor-pointer shadow-xs min-h-[30px]"
                    >
                      <Sparkles className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                      <span>{q}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading Bubble */}
        {isSending && (
          <div className="flex gap-2.5 sm:gap-3 mr-auto max-w-[85%] items-center">
            <div className="w-7 h-7 rounded-lg bg-slate-800/80 border border-slate-700 text-blue-400 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="bg-slate-950/80 text-slate-400 p-2.5 sm:p-3 rounded-2xl text-xs border border-slate-800 flex items-center gap-2 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:0.4s]" />
              <span className="text-[10px] sm:text-[11px]">Inspecting sensor logs...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Field */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-2.5 sm:p-3 border-t border-slate-800 bg-slate-950/80 flex items-center gap-2"
      >
        <input
          id="chat-user-input"
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder="Ask e.g. 'How much water did we use today?'"
          disabled={isSending}
          className="flex-1 bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm sm:text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition-all font-mono min-h-[42px]"
        />
        <button
          id="send-chat-button"
          type="submit"
          disabled={!inputQuery.trim() || isSending}
          className="p-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/50 disabled:opacity-40 disabled:border-slate-800 transition-all shadow-[0_0_15px_rgba(59,130,246,0.2)] cursor-pointer min-h-[42px] min-w-[42px] flex items-center justify-center shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
