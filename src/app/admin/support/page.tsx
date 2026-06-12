"use client";

import { useState, useEffect } from "react";
import { LifeBuoy, Send, X, Inbox, ArrowLeft, Terminal, Mail } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Ticket {
  id: string;
  userId: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: string;
  senderId: string;
  message: string;
  createdAt: string;
}

const CANNED_RESPONSES = [
  "Hello! We are looking into this issue right now.",
  "Please provide more details or a screenshot of the error.",
  "Your issue has been resolved. Let us know if you need anything else.",
  "As Vaultr uses Zero-Knowledge encryption, we cannot recover your master password. If you lost it, you will need to delete your account and start over.",
  "Your account has been temporarily flagged for security review. We will update you shortly."
];

export default function AdminSupportPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected ticket view state
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [sendingReply, setSendingReply] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showMacros, setShowMacros] = useState(false);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/support");
      if (!res.ok) throw new Error("Failed to fetch tickets");
      setTickets(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchMessages = async (ticketId: string) => {
    try {
      const res = await fetch(`/api/admin/support/${ticketId}/messages`);
      if (res.ok) setMessages(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!selectedTicket) return;
    const interval = setInterval(() => {
      fetchMessages(selectedTicket.id);
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedTicket]);

  const handleOpenTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setMessages([]);
    setReplyText("");
    fetchMessages(ticket.id);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;

    setSendingReply(true);
    try {
      const res = await fetch(`/api/admin/support/${selectedTicket.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyText, sendEmail }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      
      const newMsg = await res.json();
      setMessages([...messages, newMsg]);
      setReplyText("");
      setShowMacros(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSendingReply(false);
    }
  };

  const handleUpdateTicket = async (field: string, value: string) => {
    if (!selectedTicket) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch("/api/admin/support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ticketId: selectedTicket.id, 
          status: field === "status" ? value : selectedTicket.status,
          priority: field === "priority" ? value : selectedTicket.priority
        }),
      });
      if (!res.ok) throw new Error("Failed to update ticket");
      
      const updated = await res.json();
      setSelectedTicket(updated);
      setTickets(tickets.map(t => t.id === updated.id ? updated : t));
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "text-orange-400 bg-orange-400/10 border-orange-400/20";
      case "pending": return "text-blue-400 bg-blue-400/10 border-blue-400/20";
      case "resolved": return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
      default: return "text-neutral-400 bg-neutral-400/10 border-neutral-400/20";
    }
  };

  if (selectedTicket) {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)] -mt-4 text-neutral-100">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSelectedTicket(null)}
              className="p-2 rounded-lg hover:bg-neutral-800 border border-neutral-800 bg-neutral-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-neutral-400" />
            </button>
            <div>
              <h2 className="text-xl font-bold">{selectedTicket.subject}</h2>
              <div className="text-sm text-neutral-400 mt-1 flex items-center gap-2">
                User ID: <span className="font-mono text-xs bg-neutral-900 px-1 py-0.5 rounded border border-neutral-800">{selectedTicket.userId}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase font-bold text-neutral-500 mb-1">Status</span>
              <select 
                value={selectedTicket.status}
                onChange={(e) => handleUpdateTicket("status", e.target.value)}
                disabled={updatingStatus}
                className={`text-sm rounded border px-2 py-1 bg-neutral-900 focus:outline-none focus:border-indigo-500 ${getStatusColor(selectedTicket.status)}`}
              >
                <option value="open">Open</option>
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase font-bold text-neutral-500 mb-1">Priority</span>
              <select 
                value={selectedTicket.priority}
                onChange={(e) => handleUpdateTicket("priority", e.target.value)}
                disabled={updatingStatus}
                className="text-sm rounded border border-neutral-800 bg-neutral-900 text-neutral-200 px-2 py-1 focus:outline-none focus:border-indigo-500"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex-1 border border-neutral-800 bg-neutral-950 rounded-xl overflow-hidden flex flex-col relative">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-neutral-500">
                <Inbox className="w-12 h-12 mb-4 opacity-20" />
                <p>No messages in this ticket.</p>
              </div>
            ) : (
              messages.map(msg => {
                const isAdmin = msg.senderId === "ADMIN";
                return (
                  <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] px-5 py-3 rounded-2xl shadow-sm ${
                      isAdmin 
                        ? "bg-indigo-600 text-white rounded-br-none" 
                        : "bg-neutral-800 text-neutral-100 border border-neutral-700 rounded-bl-none"
                    }`}>
                      <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</div>
                      <div className={`text-[11px] mt-2 flex items-center justify-between ${isAdmin ? "text-indigo-200" : "text-neutral-400"}`}>
                        <span>{isAdmin ? "Admin (You)" : "User"}</span>
                        <span>{new Date(msg.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {showMacros && (
            <div className="absolute bottom-[80px] left-4 right-4 bg-neutral-900 border border-neutral-800 shadow-2xl rounded-lg overflow-hidden z-10 animate-in slide-in-from-bottom-2">
              <div className="px-4 py-3 border-b border-neutral-800 bg-neutral-950 flex justify-between items-center">
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Canned Responses</span>
                <button onClick={() => setShowMacros(false)} className="text-neutral-400 hover:text-neutral-100"><X className="w-4 h-4"/></button>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {CANNED_RESPONSES.map((macro, i) => (
                  <button 
                    key={i}
                    onClick={() => { setReplyText(macro); setShowMacros(false); }}
                    className="w-full text-left px-4 py-3 text-sm text-neutral-200 hover:bg-neutral-800 border-b border-neutral-800/50 last:border-0 transition-colors"
                  >
                    {macro}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 border-t border-neutral-800 bg-neutral-900">
            <form onSubmit={handleSendReply} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowMacros(!showMacros)}
                  className="px-3 py-2 border border-neutral-700 bg-neutral-800 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-700 transition-colors"
                  title="Canned Responses"
                >
                  <Terminal className="w-5 h-5" />
                </button>
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your reply to the user..."
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-sm text-neutral-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || sendingReply}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-500 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  <Send className="w-4 h-4" /> Send
                </button>
              </div>
              <div className="flex items-center px-1">
                <label className="flex items-center gap-2 text-xs text-neutral-400 cursor-pointer hover:text-neutral-300">
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    className="rounded bg-neutral-950 border-neutral-700 text-indigo-600 focus:ring-indigo-600 focus:ring-offset-neutral-900"
                  />
                  <Mail className="w-3 h-3" />
                  Send email notification to user
                </label>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-neutral-100">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <LifeBuoy className="h-6 w-6 text-indigo-500" />
          Support Inbox
        </h1>
        <p className="text-neutral-400 mt-1">
          Manage user support tickets and respond to queries.
        </p>
      </div>

      {error && <div className="p-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">{error}</div>}

      <div className="border border-neutral-800 bg-neutral-900 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-neutral-500 animate-pulse">Loading tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="p-16 text-center">
            <Inbox className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-neutral-200">Inbox Zero</h3>
            <p className="text-neutral-400 mt-1">No support tickets found.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-neutral-950 text-neutral-400 border-b border-neutral-800">
              <tr>
                <th className="px-6 py-4 font-medium w-1/2">Subject</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Priority</th>
                <th className="px-6 py-4 font-medium text-right">Created At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {tickets.map(ticket => (
                <tr 
                  key={ticket.id} 
                  onClick={() => handleOpenTicket(ticket)}
                  className="hover:bg-neutral-800/50 cursor-pointer transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-neutral-200 group-hover:text-indigo-400 transition-colors">
                      {ticket.subject}
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-1 font-mono">
                      {ticket.userId}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] uppercase font-bold border ${getStatusColor(ticket.status)}`}>
                      {ticket.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-neutral-400 capitalize">{ticket.priority}</span>
                  </td>
                  <td className="px-6 py-4 text-right text-neutral-500">
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
