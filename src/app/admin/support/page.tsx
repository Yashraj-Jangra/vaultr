"use client";

import { useState, useEffect } from "react";
import { 
  LifeBuoy, Send, X, Inbox, ArrowLeft, Terminal, Mail, 
  Search, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock, Trash2, MoreVertical
} from "lucide-react";
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

  // Search & Pagination & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Mass Actions
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [processingBulk, setProcessingBulk] = useState(false);

  // Selected ticket view state
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [sendingReply, setSendingReply] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showMacros, setShowMacros] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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

  const handleBulkAction = async (action: string) => {
    if (selectedTicketIds.length === 0 || processingBulk) return;
    if (action === "delete" && !confirm(`Permanently delete ${selectedTicketIds.length} tickets?`)) return;

    setProcessingBulk(true);
    try {
      if (action === "delete") {
        const res = await fetch("/api/admin/support/bulk", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketIds: selectedTicketIds })
        });
        if (!res.ok) throw new Error(await res.text());
        setTickets(tickets.filter(t => !selectedTicketIds.includes(t.id)));
      } else {
        const res = await fetch("/api/admin/support/bulk", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketIds: selectedTicketIds, status: action })
        });
        if (!res.ok) throw new Error(await res.text());
        setTickets(tickets.map(t => selectedTicketIds.includes(t.id) ? { ...t, status: action } : t));
      }
      setSelectedTicketIds([]);
    } catch (err: any) {
      alert("Bulk action failed: " + err.message);
    } finally {
      setProcessingBulk(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedTicketIds.length === currentTickets.length) {
      setSelectedTicketIds([]);
    } else {
      setSelectedTicketIds(currentTickets.map(t => t.id));
    }
  };

  const toggleSelectTicket = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedTicketIds.includes(id)) {
      setSelectedTicketIds(selectedTicketIds.filter(tId => tId !== id));
    } else {
      setSelectedTicketIds([...selectedTicketIds, id]);
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

  // Filtering & Pagination Logic
  const filteredTickets = tickets.filter((t) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = t.subject.toLowerCase().includes(q) || t.userId.toLowerCase().includes(q) || t.id.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / rowsPerPage));
  const currentTickets = filteredTickets.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedTicketIds([]);
  }, [searchQuery, statusFilter, rowsPerPage]);

  if (selectedTicket) {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)] -mt-4 text-[var(--fg)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4 mb-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSelectedTicket(null)}
              className="p-2 rounded-lg hover:bg-[var(--bg)] border border-[var(--border)] bg-[var(--surface)] transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[var(--fg-muted)]" />
            </button>
            <div>
              <h2 className="text-xl font-bold">{selectedTicket.subject}</h2>
              <div className="text-sm text-[var(--fg-muted)] mt-1 flex items-center gap-2">
                User ID: <span className="font-mono text-xs bg-[var(--bg)] px-1 py-0.5 rounded border border-[var(--border)]">{selectedTicket.userId}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase font-bold text-[var(--fg-muted)] mb-1">Status</span>
              <select 
                value={selectedTicket.status}
                onChange={(e) => handleUpdateTicket("status", e.target.value)}
                disabled={updatingStatus}
                className={`text-sm rounded border px-2 py-1 bg-[var(--surface)] focus:outline-none focus:border-[var(--accent)] ${getStatusColor(selectedTicket.status)}`}
              >
                <option value="open">Open</option>
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase font-bold text-[var(--fg-muted)] mb-1">Priority</span>
              <select 
                value={selectedTicket.priority}
                onChange={(e) => handleUpdateTicket("priority", e.target.value)}
                disabled={updatingStatus}
                className="text-sm rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] px-2 py-1 focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex-1 border border-[var(--border)] bg-[var(--surface)] rounded-xl overflow-hidden flex flex-col relative shadow-sm">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[var(--fg-muted)]">
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
                        ? "bg-[var(--accent)] text-white rounded-br-none" 
                        : "bg-[var(--bg)] text-[var(--fg)] border border-[var(--border)] rounded-bl-none"
                    }`}>
                      <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</div>
                      <div className={`text-[11px] mt-2 flex items-center justify-between ${isAdmin ? "text-white/70" : "text-[var(--fg-muted)]"}`}>
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
            <div className="absolute bottom-[80px] left-4 right-4 bg-[var(--surface)] border border-[var(--border)] shadow-2xl rounded-lg overflow-hidden z-10 animate-in slide-in-from-bottom-2">
              <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--bg)] flex justify-between items-center">
                <span className="text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wider">Canned Responses</span>
                <button onClick={() => setShowMacros(false)} className="text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"><X className="w-4 h-4"/></button>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {CANNED_RESPONSES.map((macro, i) => (
                  <button 
                    key={i}
                    onClick={() => { setReplyText(macro); setShowMacros(false); }}
                    className="w-full text-left px-4 py-3 text-sm text-[var(--fg)] hover:bg-[var(--bg)] border-b border-[var(--border)] last:border-0 transition-colors"
                  >
                    {macro}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 border-t border-[var(--border)] bg-[var(--surface)]">
            <form onSubmit={handleSendReply} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowMacros(!showMacros)}
                  className="px-3 py-2 border border-[var(--border)] bg-[var(--bg)] rounded-lg text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
                  title="Canned Responses"
                >
                  <Terminal className="w-5 h-5" />
                </button>
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your reply to the user..."
                  className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-4 py-2 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--fg-muted)]"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || sendingReply}
                  className="bg-[var(--accent)] text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  <Send className="w-4 h-4" /> Send
                </button>
              </div>
              <div className="flex items-center px-1">
                <label className="flex items-center gap-2 text-xs text-[var(--fg-muted)] cursor-pointer hover:text-[var(--fg)] transition-colors">
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    className="rounded bg-[var(--bg)] border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
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
    <div className="p-8 pb-20">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--fg)] flex items-center gap-2">
            <LifeBuoy className="w-6 h-6 text-[var(--accent)]" /> Support Inbox
          </h2>
          <p className="text-sm text-[var(--fg-muted)] mt-1">Manage user support tickets, respond to queries, and perform bulk actions.</p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-[var(--fg-muted)] bg-[var(--surface)] px-4 py-2 rounded-lg border border-[var(--border)]">
          <Inbox className="w-4 h-4 mr-2" />
          <span>Total {tickets.length} tickets</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
            <input
              type="text"
              placeholder="Search by subject or User ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors text-[var(--fg)] placeholder:text-[var(--fg-muted)]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[var(--surface)] border border-[var(--border)] text-[var(--fg)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors cursor-pointer hidden sm:block"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        
        <div className="flex items-center gap-4 text-sm w-full sm:w-auto">
          <span className="text-[var(--fg-muted)] whitespace-nowrap">Rows per page:</span>
          <select
            value={rowsPerPage}
            onChange={(e) => setRowsPerPage(Number(e.target.value))}
            className="bg-[var(--surface)] border border-[var(--border)] text-[var(--fg)] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[var(--accent)] transition-colors cursor-pointer"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-[var(--danger)]/10 text-[var(--danger)] border border-[var(--danger)]/20 flex items-center">
          <XCircle className="w-5 h-5 mr-2" />
          {error}
        </div>
      )}

      {selectedTicketIds.length > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-between animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center bg-[var(--accent)] text-white w-6 h-6 rounded-full text-xs font-bold">
              {selectedTicketIds.length}
            </span>
            <span className="text-sm font-medium text-[var(--accent)] opacity-80">tickets selected</span>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => handleBulkAction("resolved")}
              disabled={processingBulk}
              className="flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-[#34d399]/20 text-[#34d399] hover:bg-[#34d399]/30 transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Mark Resolved
            </button>
            <button 
              onClick={() => handleBulkAction("delete")}
              disabled={processingBulk}
              className="flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--danger)]/20 text-[var(--danger)] hover:bg-[var(--danger)]/30 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
            </button>
          </div>
        </div>
      )}

      <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)] shadow-sm">
        <div className="flex items-center px-5 py-3 border-b border-[var(--border)] bg-[var(--bg)]/50 rounded-t-xl">
          <input 
            type="checkbox"
            checked={currentTickets.length > 0 && selectedTicketIds.length === currentTickets.length}
            onChange={toggleSelectAll}
            className="rounded bg-[var(--bg)] border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
          />
          <span className="text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wider ml-4">Tickets</span>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {loading ? (
             <div className="p-12 flex justify-center">
               <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
             </div>
          ) : currentTickets.length === 0 ? (
            <div className="p-16 text-center">
              <Inbox className="w-10 h-10 text-[var(--fg-muted)]/50 mx-auto mb-3" />
              <p className="text-[var(--fg-muted)] text-sm">No tickets found matching your criteria.</p>
            </div>
          ) : currentTickets.map((t) => (
            <div key={t.id} onClick={() => handleOpenTicket(t)} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 hover:bg-[var(--bg)]/40 transition-colors group cursor-pointer last:rounded-b-xl">
              <div className="flex items-start gap-4">
                <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                  <input 
                    type="checkbox"
                    checked={selectedTicketIds.includes(t.id)}
                    onChange={(e) => toggleSelectTicket(t.id, e as any)}
                    className="rounded bg-[var(--bg)] border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                  />
                </div>
                <div>
                  <div className="font-medium text-[var(--fg)] group-hover:text-[var(--accent)] transition-colors">
                    {t.subject}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[var(--fg-muted)] font-mono text-[11px] truncate max-w-[150px] sm:max-w-xs">{t.userId}</span>
                  </div>
                  <div className="text-[10px] text-[var(--fg-muted)] mt-1.5 sm:hidden flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {new Date(t.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4 mt-4 sm:mt-0 pl-8 sm:pl-0">
                  <div className="flex gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(t.status)}`}>
                      {t.status}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--bg)] border border-[var(--border)] text-[var(--fg-muted)] capitalize">
                      {t.priority} Priority
                    </span>
                    <span className="hidden sm:inline-flex items-center text-[11px] text-[var(--fg-muted)] whitespace-nowrap ml-2">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div 
                    className="relative ml-2"
                    tabIndex={-1}
                    onBlur={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setOpenMenuId(null);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => setOpenMenuId(openMenuId === t.id ? null : t.id)}
                      className="p-2 rounded-lg text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg)] transition-colors border border-transparent hover:border-[var(--border)]"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    <div className={`absolute right-0 top-10 w-40 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-2xl transition-all z-50 p-1 flex flex-col ${openMenuId === t.id ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible -translate-y-2'}`}>
                      <button 
                        onClick={() => { setSelectedTicketIds([t.id]); handleBulkAction("resolved"); setOpenMenuId(null); }} 
                        className="flex items-center w-full px-3 py-2 text-xs hover:bg-[var(--bg)] text-[#34d399] rounded-md text-left transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Mark Resolved
                      </button>
                      <div className="h-px bg-[var(--border)] my-1" />
                      <button 
                        onClick={() => { setSelectedTicketIds([t.id]); handleBulkAction("delete"); setOpenMenuId(null); }}
                        className="flex items-center w-full px-3 py-2 text-xs hover:bg-[var(--danger)] hover:text-white text-[var(--danger)] rounded-md text-left transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Ticket
                      </button>
                    </div>
                  </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
        <div className="text-sm text-[var(--fg-muted)]">
          Showing {filteredTickets.length > 0 ? Math.min((currentPage - 1) * rowsPerPage + 1, filteredTickets.length) : 0} to {Math.min(currentPage * rowsPerPage, filteredTickets.length)} of {filteredTickets.length} results
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] hover:bg-[var(--bg)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium px-4 text-[var(--fg)]">
            {currentPage} <span className="text-[var(--fg-muted)]">/ {totalPages}</span>
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="p-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] hover:bg-[var(--bg)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
