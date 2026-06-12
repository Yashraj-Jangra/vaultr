"use client";

import { useState, useEffect } from "react";
import { Plus, X, Clock, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Ticket { id: string; subject: string; status: string; priority: string; createdAt: string; updatedAt: string; }
interface Message { id: string; senderId: string; message: string; createdAt: string; }

function FieldBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-neutral-900/40 border border-neutral-800/60 rounded-xl p-5">
      {children}
    </div>
  );
}

export default function SupportSettingsPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState("normal");

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/support");
      if (!res.ok) throw new Error("Failed to fetch tickets");
      setTickets(await res.json());
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  useEffect(() => { if (user) fetchTickets(); }, [user]);

  const fetchMessages = async (ticketId: string) => {
    try {
      const res = await fetch(`/api/support/${ticketId}/messages`);
      if (res.ok) setMessages(await res.json());
    } catch (err) { console.error(err); }
  };

  const handleOpenTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setMessages([]);
    fetchMessages(ticket.id);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    try {
      const res = await fetch("/api/support", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, priority }),
      });
      if (!res.ok) throw new Error("Failed to create ticket");
      const newTicket = await res.json();
      setTickets([newTicket, ...tickets]);
      setCreating(false); setSubject("");
      handleOpenTicket(newTicket);
    } catch (err: any) { setError(err.message); }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;
    setSendingReply(true);
    try {
      const res = await fetch(`/api/support/${selectedTicket.id}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyText }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      const newMsg = await res.json();
      setMessages([...messages, newMsg]);
      setReplyText("");
    } catch (err) { console.error(err); } finally { setSendingReply(false); }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "text-orange-400 border-orange-900/50 bg-orange-950/20";
      case "pending": return "text-blue-400 border-blue-900/50 bg-blue-950/20";
      case "resolved": return "text-emerald-400 border-emerald-900/50 bg-emerald-950/20";
      default: return "text-neutral-400 border-neutral-700 bg-neutral-900";
    }
  };

  if (selectedTicket) {
    return (
      <div className="max-w-4xl mx-auto h-[calc(100vh-140px)] flex flex-col">
        <div className="flex items-center justify-between pb-6 border-b border-[var(--border)] shrink-0">
          <div>
            <h2 className="text-[16px] font-semibold text-neutral-100">{selectedTicket.subject}</h2>
            <div className="flex items-center gap-3 text-[11px] mt-2">
              <span className={`px-2 py-0.5 rounded-md border uppercase tracking-widest font-medium ${getStatusColor(selectedTicket.status)}`}>
                {selectedTicket.status}
              </span>
              <span className="text-neutral-500 flex items-center gap-1.5 font-medium">
                <Clock className="w-3.5 h-3.5" />
                {new Date(selectedTicket.createdAt).toLocaleString()}
              </span>
            </div>
          </div>
          <button onClick={() => setSelectedTicket(null)} className="text-[12px] font-medium text-neutral-400 hover:text-neutral-200 transition-colors px-4 py-2 border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 rounded-lg shadow-sm">
            Close Ticket
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-8 pr-4 space-y-6 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
          {messages.length === 0 ? (
            <p className="text-[13px] text-neutral-500 italic">No messages yet.</p>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderId === user?.id;
              return (
                <div key={msg.id} className="space-y-1.5 max-w-[85%]">
                  <div className="flex items-baseline gap-3">
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${isMe ? "text-[var(--accent)]" : "text-neutral-400"}`}>
                      {isMe ? "You" : "Support"}
                    </span>
                    <span className="text-[10px] text-neutral-600 font-medium">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="text-[13px] text-neutral-300 leading-relaxed whitespace-pre-wrap pl-3 border-l-2 border-neutral-800 py-0.5">
                    {msg.message}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="pt-6 border-t border-[var(--border)] shrink-0">
          {selectedTicket.status === "resolved" ? (
            <div className="p-4 bg-emerald-950/10 border border-emerald-900/30 rounded-lg text-[13px] text-emerald-500 font-medium text-center">
              This ticket has been marked as resolved and is closed to new messages.
            </div>
          ) : (
            <form onSubmit={handleSendReply} className="flex gap-4">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply..."
                className="flex-1 bg-neutral-900 border border-neutral-800 px-4 py-3 rounded-lg text-[13px] text-neutral-200 focus:outline-none focus:border-[var(--accent)] transition-colors placeholder:text-neutral-600 shadow-sm"
              />
              <button
                type="submit"
                disabled={!replyText.trim() || sendingReply}
                className="text-[13px] font-medium bg-[var(--accent)] text-[var(--bg)] disabled:opacity-50 hover:opacity-90 transition-opacity px-6 rounded-lg shadow-sm"
              >
                Send
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-10 border-b border-[var(--border)] pb-6">
        <div className="space-y-1">
          <h1 className="text-[22px] font-semibold text-neutral-100">Support</h1>
          <p className="text-[14px] text-neutral-500 mt-1">Contact our team for help.</p>
        </div>
        <button
          onClick={() => setCreating(!creating)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors border border-neutral-700 bg-neutral-800 text-neutral-300 hover:text-neutral-100 hover:bg-neutral-700 shadow-sm"
        >
          {creating ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {creating ? "Cancel" : "New Ticket"}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-950/20 border border-red-900/40 rounded-xl text-[13px] text-red-400 font-medium">
          {error}
        </div>
      )}

      {creating && (
        <FieldBox>
          <form onSubmit={handleCreateTicket} className="space-y-5">
            <h3 className="text-[14px] font-semibold text-neutral-200">Create New Ticket</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-3 space-y-1.5">
                <label className="text-[12px] font-medium text-neutral-400 uppercase tracking-widest">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2.5 text-[13px] text-neutral-200 focus:outline-none focus:border-[var(--accent)] transition-colors placeholder:text-neutral-600 shadow-sm"
                  placeholder="Briefly describe your issue..."
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-neutral-400 uppercase tracking-widest">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2.5 text-[13px] text-neutral-300 focus:outline-none focus:border-[var(--accent)] shadow-sm"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={!subject.trim()}
                className="text-[13px] font-medium bg-[var(--accent)] text-[var(--bg)] px-6 py-2 rounded-lg disabled:opacity-50 hover:opacity-90 transition-opacity shadow-sm"
              >
                Submit Ticket
              </button>
            </div>
          </form>
        </FieldBox>
      )}

      {loading ? (
        <div className="py-12 text-center text-[13px] text-neutral-500 font-medium">Loading tickets...</div>
      ) : tickets.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-neutral-800 rounded-2xl bg-neutral-900/30">
          <p className="text-[14px] font-medium text-neutral-400">No tickets found.</p>
          <p className="text-[13px] text-neutral-600 mt-1">If you need help, open a new ticket above.</p>
        </div>
      ) : (
        <FieldBox>
          <ul className="divide-y divide-neutral-800/60 -mx-5 -my-5">
            {tickets.map(ticket => (
              <li key={ticket.id}>
                <button 
                  onClick={() => handleOpenTicket(ticket)}
                  className="w-full text-left p-5 hover:bg-neutral-800/40 transition-colors flex items-center justify-between group focus:outline-none"
                >
                  <div>
                    <h3 className="text-[14px] font-medium text-neutral-200 group-hover:text-[var(--accent)] transition-colors">{ticket.subject}</h3>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border ${getStatusColor(ticket.status)}`}>{ticket.status}</span>
                      <span className="text-[12px] font-medium text-neutral-500">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:text-[var(--accent)] transition-colors" />
                </button>
              </li>
            ))}
          </ul>
        </FieldBox>
      )}
    </div>
  );
}
