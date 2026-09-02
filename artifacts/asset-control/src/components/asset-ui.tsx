import { Link, useLocation } from 'wouter';
import { type ReactNode } from 'react';
import { useClerk, useUser } from '@clerk/react';
import { Bell, Boxes, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, ClipboardList, FileText, Home, Menu, MoreHorizontal, Search, ShieldCheck, UsersRound, Wrench, X, ArrowUpRight, RefreshCw, Pencil, Trash2, Users } from 'lucide-react';
import type { Asset, MaintenanceItem } from '@workspace/api-client-react';
import { useRole, ROLE_LABELS, canViewTeam, canViewReports } from '@/lib/role';

export const statusLabels: Record<string, string> = { available: 'Available', assigned: 'Assigned', in_repair: 'In repair', rma: 'RMA', retired: 'Retired', lost: 'Lost' };
export const statusTone: Record<string, string> = { available: 'status-green', assigned: 'status-blue', in_repair: 'status-orange', rma: 'status-red', retired: 'status-gray', lost: 'status-purple' };

export function StatusPill({ status }: { status: string }) {
  return <span data-testid={`status-${status}`} className={`status-pill ${statusTone[status] ?? 'status-gray'}`}><i />{statusLabels[status] ?? status}</span>;
}

export function Skeleton({ className = '' }: { className?: string }) { return <div className={`skeleton ${className}`} />; }

export function LoadingBlock() {
  return <div className="loading-block" data-testid="status-loading"><Skeleton className="h-7 w-48" /><Skeleton className="mt-3 h-4 w-72" /><div className="mt-8 grid gap-4 md:grid-cols-4"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div></div>;
}

export function ErrorState({ onRetry, message = 'The command center could not reach the asset service.' }: { onRetry?: () => void; message?: string }) {
  return <div className="empty-state" data-testid="status-error"><div className="empty-icon"><RefreshCw size={20} /></div><h3>Connection interrupted</h3><p>{message}</p>{onRetry && <button data-testid="button-retry" className="button button-dark" onClick={onRetry}>Try again</button>}</div>;
}

export function EmptyState({ title = 'Nothing in this view', text = 'There is no operational data to show yet.' }: { title?: string; text?: string }) {
  return <div className="empty-state" data-testid="status-empty"><div className="empty-icon"><Boxes size={20} /></div><h3>{title}</h3><p>{text}</p></div>;
}

export function Sidebar() {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { role } = useRole();
  const nav = [
    { href: '/workspace', label: 'Overview', icon: Home },
    { href: '/inventory', label: 'Inventory', icon: Boxes },
    { href: '/maintenance', label: 'Maintenance', icon: Wrench },
    { href: '/directory', label: 'Directory', icon: Users },
    ...(canViewTeam(role) ? [{ href: '/team', label: 'Team', icon: UsersRound }] : []),
    ...(canViewReports(role) ? [{ href: '/reports', label: 'Reports', icon: FileText }] : []),
  ];
  const isActive = (href: string) => location === href || location.startsWith(`${href}/`);
  const roleLabel = role ? ROLE_LABELS[role] : 'Signed-in operator';
  return <aside className="sidebar">
    <Link href="/" className="brand" data-testid="link-brand"><span className="brand-mark"><ShieldCheck size={20} strokeWidth={2.4} /></span><span className="brand-copy"><strong>asset<span>control</span></strong><small>OPERATIONS CONSOLE</small></span></Link>
    <nav className="side-nav"><div className="nav-section">Workspace</div>{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-testid={`link-${label.toLowerCase()}`} className={`nav-item ${isActive(href) ? 'active' : ''}`}><Icon size={18} /><span className="nav-label">{label}</span></Link>)}</nav>
    <div className="sidebar-foot"><div className="health-row"><span className="health-dot" /> All systems operational</div><button className="profile profile-button" onClick={() => void signOut({ redirectUrl: '/' })}><span className="avatar">{(user?.firstName?.[0] ?? user?.emailAddresses[0]?.emailAddress[0] ?? "U").toUpperCase()}</span><span className="profile-copy"><b>{user?.fullName ?? user?.emailAddresses[0]?.emailAddress ?? "Signed-in operator"}</b><small data-testid="text-role">{roleLabel} · Sign out</small></span><MoreHorizontal size={17} /></button></div>
  </aside>;
}

export function Topbar({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <header className="topbar"><div className="mobile-menu"><Menu size={20} /></div><div><div className="eyebrow">AssetControl / workspace</div><h1 data-testid="text-page-title">{title}</h1>{description && <p>{description}</p>}</div><div className="topbar-actions"><button className="icon-button" aria-label="Help" data-testid="button-help"><CircleHelp size={18} /></button><button className="icon-button notice" aria-label="Notifications" data-testid="button-notifications"><Bell size={18} /><i /></button>{action}</div></header>;
}

export function AppShell({ children }: { children: ReactNode }) { return <div className="app-shell noise"><Sidebar /><main className="main-area">{children}</main></div>; }

export function Card({ children, className = '', ...props }: { children: ReactNode; className?: string; [key: string]: unknown }) { return <section className={`panel ${className}`} {...props}>{children}</section>; }

export function AssetTable({ items, selected, onSelect, compact = false, selectable = true }: { items: Asset[]; selected: string[]; onSelect: (id: string) => void; compact?: boolean; selectable?: boolean }) {
  const [, setLocation] = useLocation();
  const showSelect = selectable && !compact;
  return <div className="table-scroll"><table className={`asset-table ${compact ? 'compact' : ''}`}><thead><tr>{showSelect && <th className="check-col"><span className="fake-check" /></th>}<th>Asset</th><th>Category</th><th>Status</th><th>Assigned to</th><th>Location</th><th>Updated</th><th /></tr></thead><tbody>{items.map((asset) => <tr key={asset.id} data-testid={`row-asset-${asset.id}`} onClick={() => setLocation(`/assets/${asset.id}`)}>{showSelect && <td onClick={(e) => e.stopPropagation()}><button className={`fake-check ${selected.includes(asset.id) ? 'checked' : ''}`} aria-label={`Select ${asset.assetTag}`} data-testid={`checkbox-asset-${asset.id}`} onClick={() => onSelect(asset.id)}>{selected.includes(asset.id) ? '✓' : ''}</button></td>}<td><div className="asset-name"><span className="asset-glyph">{asset.category?.slice(0, 1) ?? 'A'}</span><span><b>{asset.name}</b><small className="mono">{asset.assetTag}</small></span></div></td><td>{asset.category}</td><td><StatusPill status={asset.status} /></td><td>{asset.assignee ? <div className="person-cell"><span className="avatar small">{asset.assignee.name.split(' ').map(x => x[0]).join('').slice(0,2)}</span>{asset.assignee.name}</div> : <span className="muted">Unassigned</span>}</td><td>{asset.location?.name ?? '—'}</td><td className="muted">{formatRelative(asset.lastUpdated)}</td><td><button className="row-arrow" aria-label={`Open ${asset.assetTag}`} data-testid={`button-open-${asset.id}`} onClick={(e) => { e.stopPropagation(); setLocation(`/assets/${asset.id}`); }}><ArrowUpRight size={16} /></button></td></tr>)}</tbody></table></div>;
}

export function SearchBox({ value, onChange, placeholder = 'Search assets, tags, serials...' }: { value: string; onChange: (value: string) => void; placeholder?: string }) { return <label className="search-box"><Search size={17} /><input data-testid="input-search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /><kbd>⌘ K</kbd></label>; }
export function SelectField({ value, onChange, options, label, testId }: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; label?: string; testId?: string }) { return <label className="select-wrap">{label && <span>{label}</span>}<select data-testid={testId} value={value} onChange={(e) => onChange(e.target.value)}><option value="">All {label ?? 'items'}</option>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select><ChevronDown size={14} /></label>; }
export function Button({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) { return <button className={`button ${className}`} {...props}>{children}</button>; }

export function MetricCard({ label, value, detail, tone = 'teal', icon: Icon }: { label: string; value: string | number; detail: string; tone?: string; icon: typeof Boxes }) { return <div className={`metric-card ${tone}`}><div className="metric-top"><span className="metric-label">{label}</span><span className="metric-icon"><Icon size={16} /></span></div><strong data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</strong><span className="metric-detail">{detail}</span></div>; }

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) { const pages = Math.max(1, Math.ceil(total / pageSize)); return <div className="pagination"><span>Showing <b>{total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)}</b> of <b>{total}</b></span><div><button data-testid="button-page-prev" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={16} /></button><span className="page-number">{page} / {pages}</span><button data-testid="button-page-next" disabled={page >= pages} onClick={() => onPage(page + 1)}><ChevronRight size={16} /></button></div></div>; }

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) { return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><div className="modal" role="dialog" aria-modal="true"><div className="modal-head"><div><div className="eyebrow">AssetControl / action</div><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close" data-testid="button-close-modal"><X size={18} /></button></div>{children}</div></div>; }

export function formatRelative(value?: string | null) { if (!value) return '—'; const date = new Date(value); if (Number.isNaN(date.getTime())) return value; const mins = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000)); if (mins < 60) return `${mins}m ago`; if (mins < 1440) return `${Math.round(mins / 60)}h ago`; return `${Math.round(mins / 1440)}d ago`; }
export function formatDate(value?: string | null) { if (!value) return 'Not set'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
export function formatMoney(value?: number | null) { return value == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value); }

export function ActivityList({ events }: { events: { id: string; type: string; message: string; actor: string; createdAt: string; assetTag: string | null }[] }) { return <div className="activity-list">{events.map((event) => <div className="activity-item" key={event.id} data-testid={`activity-${event.id}`}><div className={`activity-mark activity-${event.type}`}><ClipboardList size={14} /></div><div><p>{event.message}</p><span>{event.actor} <i /> {formatRelative(event.createdAt)} {event.assetTag && <><i /> <b className="mono">{event.assetTag}</b></>}</span></div></div>)}</div>; }
export function MaintenanceList({ items, limit, onEdit, onDelete }: { items: MaintenanceItem[]; limit?: number; onEdit?: (item: MaintenanceItem) => void; onDelete?: (item: MaintenanceItem) => void }) { const shown = limit ? items.slice(0, limit) : items; return <div className="maintenance-list">{shown.map((item) => <div className="maintenance-item" key={item.id} data-testid={`maintenance-${item.id}`}><div className="date-block"><b>{new Date(item.scheduledAt).toLocaleDateString('en-US', { day: '2-digit' })}</b><span>{new Date(item.scheduledAt).toLocaleDateString('en-US', { month: 'short' })}</span></div><div className="maintenance-main"><div><b className="mono">{item.assetTag}</b><span className="item-category">{item.category}</span></div><p>{item.technician}</p>{item.resolutionNotes && <p className="maintenance-outcome" data-testid={`maintenance-outcome-${item.id}`}><ClipboardList size={12} /> {item.resolutionNotes}{item.completedBy ? ` — ${item.completedBy}` : ''}</p>}</div><span className={`priority priority-${item.priority}`}>{item.priority}</span><StatusPill status={item.status} />{(onEdit || onDelete) && <div className="maintenance-controls">{onEdit && <button className="row-arrow" aria-label={`Edit ${item.assetTag}`} onClick={() => onEdit(item)}><Pencil size={14} /></button>}{onDelete && <button className="row-arrow danger-action" aria-label={`Delete ${item.assetTag}`} onClick={() => onDelete(item)}><Trash2 size={14} /></button>}</div>}</div>)}</div>; }