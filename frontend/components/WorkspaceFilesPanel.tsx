'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useChat } from '../contexts/ChatContext';
import { Attachment } from '../lib/chatTypes';
import { apiUrl, authHeaders } from '../lib/api';

interface WorkspaceFile {
  id: string;
  workspace_id: number | null;
  original_filename: string;
  content_type: string;
  size: number;
  created_at: string | null;
  download_path: string;
  workspace_download_path: string | null;
  uploader_id?: number;
}

interface WorkspaceFilesPanelProps {
  workspaceId: number;
}

interface ContextMenuState {
  x: number;
  y: number;
  file: WorkspaceFile;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(file: WorkspaceFile): string {
  const ct = (file.content_type || '').toLowerCase();
  const name = file.original_filename.toLowerCase();
  if (ct.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/.test(name)) return '🖼️';
  if (ct.includes('pdf') || name.endsWith('.pdf')) return '📕';
  if (ct.includes('video') || /\.(mp4|mov|webm)$/.test(name)) return '🎞️';
  if (ct.includes('audio') || /\.(mp3|wav|ogg)$/.test(name)) return '🎵';
  if (/\.(zip|rar|7z|tar|gz)$/.test(name)) return '📦';
  if (/\.(doc|docx|txt|md|rtf)$/.test(name)) return '📄';
  if (/\.(xls|xlsx|csv)$/.test(name)) return '📊';
  if (/\.(ppt|pptx)$/.test(name)) return '📽️';
  return '📎';
}

export default function WorkspaceFilesPanel({ workspaceId }: WorkspaceFilesPanelProps) {
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const { sendAttachment: chatSendAttachment } = useChat();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(apiUrl(`/files/workspace/${workspaceId}/list`), {
        headers: authHeaders(),
      });
      setFiles(res.data?.files ?? []);
    } catch (e: any) {
      toast.error('Failed to load workspace files');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // Close context menu on outside click / escape
  useEffect(() => {
    const onDocClick = (ev: MouseEvent) => {
      if (contextMenu) setContextMenu(null);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setContextMenu(null);
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [contextMenu]);

  // ---------------- Upload ----------------
  const triggerUpload = () => {
    if (!uploading) fileInputRef.current?.click();
  };

  const uploadFiles = async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    if (arr.length === 0 || uploading) return;

    setUploading(true);
    let successCount = 0;

    for (const f of arr) {
      try {
        const form = new FormData();
        form.append('file', f);
        form.append('workspace_id', String(workspaceId));

        const res = await axios.post(apiUrl('/files/upload'), form, {
          headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' },
        });
        const data = res.data;
        successCount += 1;

        // Optimistically add to list
        const newItem: WorkspaceFile = {
          id: data.id,
          workspace_id: workspaceId,
          original_filename: data.filename || data.original_filename,
          content_type: data.content_type,
          size: data.size,
          created_at: new Date().toISOString(),
          download_path: data.download_path,
          workspace_download_path: data.workspace_download_path,
        };
        setFiles((prev) => [newItem, ...prev]);
      } catch (e: any) {
        toast.error(`Failed to upload ${f.name}: ${e?.response?.data?.detail || 'error'}`);
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} file(s) added to workspace storage`);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadFiles(e.target.files);
  };

  // Drag & drop support (great for "upload to the screen")
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  // ---------------- Actions ----------------
  function buildAttachment(file: WorkspaceFile): Attachment {
    const urlPath = file.workspace_download_path || file.download_path;
    return {
      id: file.id,
      filename: file.original_filename,
      url: apiUrl(urlPath),
      size: file.size,
      content_type: file.content_type,
    };
  }

  const doDownload = (file: WorkspaceFile) => {
    const urlPath = file.workspace_download_path || file.download_path;
    const a = document.createElement('a');
    a.href = apiUrl(urlPath);
    a.download = file.original_filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const doOpen = (file: WorkspaceFile) => {
    const urlPath = file.workspace_download_path || file.download_path;
    window.open(apiUrl(urlPath), '_blank', 'noopener,noreferrer');
  };

  const doCopyLink = async (file: WorkspaceFile) => {
    const urlPath = file.workspace_download_path || file.download_path;
    const full = apiUrl(urlPath);
    try {
      await navigator.clipboard.writeText(full);
      toast.success('Link copied to clipboard');
    } catch {
      // fallback
      prompt('Copy this link:', full);
    }
  };

  const doShareToChat = (file: WorkspaceFile) => {
    if (!chatSendAttachment) {
      toast.error('Chat not available');
      return;
    }
    const att = buildAttachment(file);
    const ok = chatSendAttachment(att, `Shared from workspace storage`, 'all');
    if (ok) {
      toast.success(`Shared "${file.original_filename}" to workspace chat`);
    } else {
      toast.error('Could not share (chat disconnected?)');
    }
  };

  // Right-click context menu
  const handleContextMenu = (e: React.MouseEvent, file: WorkspaceFile) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  };

  // Hover action bar uses group-hover. We also expose the same actions from the bar.
  const renderFileRow = (file: WorkspaceFile) => {
    const icon = getFileIcon(file);
    const when = file.created_at ? new Date(file.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

    return (
      <div
        key={file.id}
        className="group relative flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10 hover:border-sky-400/30 transition-colors cursor-default workspace-files-row"
        onContextMenu={(e) => handleContextMenu(e, file)}
        title={file.original_filename}
      >
        <div className="text-2xl select-none shrink-0">{icon}</div>

        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate pr-2">{file.original_filename}</div>
          <div className="text-[10px] text-readable-subtle flex items-center gap-2">
            <span>{formatSize(file.size)}</span>
            {when && <span>· {when}</span>}
          </div>
        </div>

        {/* Hover action buttons (appear on group hover) */}
        <div className="hidden group-hover:flex items-center gap-1 shrink-0">
          <button
            onClick={() => doDownload(file)}
            className="text-xs px-2 py-1 rounded-lg border border-white/15 hover:bg-emerald-500/10 hover:border-emerald-400/40"
            title="Download"
          >
            ⬇️
          </button>
          <button
            onClick={() => doOpen(file)}
            className="text-xs px-2 py-1 rounded-lg border border-white/15 hover:bg-white/10"
            title="Open file"
          >
            ↗
          </button>
          <button
            onClick={() => doCopyLink(file)}
            className="text-xs px-2 py-1 rounded-lg border border-white/15 hover:bg-white/10"
            title="Copy link"
          >
            ⎘
          </button>
          <button
            onClick={() => doShareToChat(file)}
            className="text-xs px-2 py-1 rounded-lg border border-amber-400/30 text-amber-300 hover:bg-amber-500/10"
            title="Share to workspace chat"
          >
            💬
          </button>
        </div>

        {/* Always visible small download affordance */}
        <button
          onClick={() => doDownload(file)}
          className="sm:hidden text-xs px-2 py-1 rounded-lg border border-white/15"
          title="Download"
        >
          ⬇
        </button>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="h-full flex flex-col bg-black/10"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 shrink-0">
        <div>
          <div className="text-sm font-semibold">Workspace Storage</div>
          <div className="text-[10px] text-readable-subtle">Files shared with this workspace / group only</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadFiles}
            disabled={loading || uploading}
            className="workspace-tool-btn text-xs"
            title="Refresh file list"
          >
            ↻
          </button>
          <button
            onClick={triggerUpload}
            disabled={uploading}
            className="btn-primary text-xs px-3 py-1.5 rounded-xl flex items-center gap-1"
          >
            {uploading ? 'Uploading…' : '↑ Upload'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={onFileInputChange}
            disabled={uploading}
          />
        </div>
      </div>

      {/* Drop zone hint */}
      <div className="px-3 pt-2 text-[10px] text-readable-subtle">
        Drop files here or use Upload. Files are private to this workspace.
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-2 min-h-0">
        {loading && (
          <div className="text-center text-readable-subtle py-8 text-sm">Loading files…</div>
        )}

        {!loading && files.length === 0 && (
          <div className="text-center py-10 text-readable-subtle">
            <div className="text-4xl mb-2">📁</div>
            <p className="text-sm">No files in this workspace yet.</p>
            <p className="text-xs mt-1">Upload or share files from chat to populate the storage.</p>
          </div>
        )}

        {!loading && files.map((f) => renderFileRow(f))}
      </div>

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          className="fixed z-[999] min-w-[160px] rounded-xl border border-white/20 bg-slate-900/95 backdrop-blur p-1 text-sm shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1 text-[10px] text-readable-subtle truncate border-b border-white/10 mb-1">
            {contextMenu.file.original_filename}
          </div>

          <button
            className="block w-full text-left px-3 py-1.5 rounded-lg hover:bg-white/10"
            onClick={() => { doDownload(contextMenu.file); setContextMenu(null); }}
          >
            ⬇️ Download
          </button>
          <button
            className="block w-full text-left px-3 py-1.5 rounded-lg hover:bg-white/10"
            onClick={() => { doOpen(contextMenu.file); setContextMenu(null); }}
          >
            ↗ Open file
          </button>
          <button
            className="block w-full text-left px-3 py-1.5 rounded-lg hover:bg-white/10"
            onClick={() => { doCopyLink(contextMenu.file); setContextMenu(null); }}
          >
            ⎘ Copy link
          </button>
          <button
            className="block w-full text-left px-3 py-1.5 rounded-lg hover:bg-amber-500/10 text-amber-300"
            onClick={() => { doShareToChat(contextMenu.file); setContextMenu(null); }}
          >
            💬 Share to chat
          </button>
        </div>
      )}
    </div>
  );
}
