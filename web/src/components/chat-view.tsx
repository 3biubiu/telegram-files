"use client";

import React, { useMemo, useState } from "react";
import { type TelegramFile } from "@/lib/types";
import { cn } from "@/lib/utils";
import prettyBytes from "pretty-bytes";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TooltipWrapper } from "@/components/ui/tooltip";
import FileImage from "@/components/file-image";
import { useFileControl } from "@/hooks/use-file-control";
import { useFileSpeed } from "@/hooks/use-file-speed";
import {
  CheckCircle2,
  Clock,
  Download,
  FileIcon,
  Film,
  FolderSync,
  ImageIcon,
  Loader2,
  Music,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";

interface ChatViewProps {
  files: TelegramFile[];
  selectedFiles: Set<number>;
  onSelectFile: (fileId: number) => void;
  onSelectAll?: () => void;
  isLoading: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  updateField?: (uniqueId: string, patch: Partial<TelegramFile>) => Promise<void>;
  chatTitle?: string;
  onViewFile?: (file: TelegramFile) => void;
}

// Single Message Bubble Component
function ChatMessageBubble({
  file,
  isSelected,
  onToggleSelect,
  onViewFile,
  updateField,
}: {
  file: TelegramFile;
  isSelected: boolean;
  onToggleSelect: () => void;
  onViewFile: (file: TelegramFile) => void;
  updateField?: (uniqueId: string, patch: Partial<TelegramFile>) => Promise<void>;
}) {
  const { downloadProgress, downloadSpeed } = useFileSpeed(file);
  const { start, togglePause } = useFileControl(file, updateField);

  // Format message time
  const timeStr = useMemo(() => {
    if (!file.date) return "";
    const d = new Date(file.date * 1000);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [file.date]);

  const isDownloading = file.downloadStatus === "downloading";
  const isCompleted = file.downloadStatus === "completed";
  const isPaused = file.downloadStatus === "paused";

  const getMediaBadge = () => {
    switch (file.type) {
      case "photo":
        return <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0 h-4 bg-sky-500/10 text-sky-600 dark:text-sky-400"><ImageIcon className="h-3 w-3" /> Photo</Badge>;
      case "video":
        return <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0 h-4 bg-purple-500/10 text-purple-600 dark:text-purple-400"><Film className="h-3 w-3" /> Video</Badge>;
      case "audio":
        return <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0 h-4 bg-amber-500/10 text-amber-600 dark:text-amber-400"><Music className="h-3 w-3" /> Audio</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><FileIcon className="h-3 w-3" /> File</Badge>;
    }
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col max-w-2xl rounded-2xl border transition-all duration-200 shadow-sm overflow-hidden",
        isSelected
          ? "border-primary bg-primary/5 ring-2 ring-primary/40 shadow-md"
          : "border-border/60 bg-card hover:border-primary/40 hover:shadow"
      )}
    >
      {/* Bubble Top Bar: Meta & Checkbox */}
      <div className="flex items-center justify-between px-3.5 pt-2.5 pb-1 gap-2 border-b border-border/30 bg-muted/20">
        <div className="flex items-center gap-2 min-w-0">
          {getMediaBadge()}
          <span className="text-[11px] text-muted-foreground truncate">
            {timeStr}
          </span>
          {file.reactionCount > 0 && (
            <Badge className="h-4 px-1.5 text-[10px] bg-blue-500/15 text-blue-600 dark:text-blue-400 border-none">
              ❤️ {file.reactionCount}
            </Badge>
          )}
        </div>

        {/* Checkbox for batch selection */}
        <div
          className="flex items-center gap-1.5 cursor-pointer select-none"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
        >
          <span className="text-xs text-muted-foreground group-hover:text-foreground hidden sm:inline">
            {isSelected ? "已选" : "选择"}
          </span>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect()}
            className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground h-4 w-4 rounded"
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-3 space-y-2">
        {/* Media Preview (Photo / Video) */}
        {(file.type === "photo" || file.type === "video") && (
          <div
            className="relative cursor-pointer overflow-hidden rounded-xl bg-black/5 dark:bg-black/40 flex items-center justify-center max-h-96 group/img"
            onClick={() => onViewFile(file)}
          >
            <FileImage
              file={file}
              className="max-h-80 w-auto object-contain rounded-lg transition-transform duration-200 group-hover/img:scale-[1.01]"
            />
            {file.type === "video" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/img:bg-black/30 transition-colors">
                <div className="rounded-full bg-black/60 p-3 text-white backdrop-blur-sm shadow-lg">
                  <Play className="h-6 w-6 fill-white" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* File/Document/Audio Card */}
        {(file.type === "file" || file.type === "audio") && (
          <div
            className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/50 hover:bg-muted/60 transition-colors cursor-pointer"
            onClick={() => onViewFile(file)}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {file.type === "audio" ? <Music className="h-6 w-6" /> : <FileIcon className="h-6 w-6" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium leading-snug">{file.fileName || "Unnamed File"}</p>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                <span>{prettyBytes(file.size || 0)}</span>
                {file.mimeType && <span>• {file.mimeType}</span>}
              </div>
            </div>
          </div>
        )}

        {/* Caption / Text */}
        {file.caption && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground/90 px-0.5">
            {file.caption}
          </p>
        )}

        {/* Download Progress Bar if downloading */}
        {isDownloading && (
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>下载中: {prettyBytes(file.downloadedSize || 0)} / {prettyBytes(file.size || 0)}</span>
              {downloadSpeed > 0 && <span>{prettyBytes(downloadSpeed)}/s</span>}
            </div>
            <Progress value={downloadProgress} className="h-1.5" />
          </div>
        )}

        {/* Footer Info & Quick Control */}
        <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>{prettyBytes(file.size || 0)}</span>
            {isCompleted && (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" /> 已完成
              </span>
            )}
            {file.transferStatus === "completed" && (
              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                <FolderSync className="h-3.5 w-3.5" /> 已转存
              </span>
            )}
          </div>

          {/* Quick Download / Pause Button */}
          <div className="flex items-center gap-1">
            {file.downloadStatus === "idle" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-primary hover:bg-primary/10"
                onClick={() => start(file.id)}
              >
                <Download className="mr-1 h-3.5 w-3.5" /> 下载
              </Button>
            )}
            {isDownloading && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-yellow-600 hover:bg-yellow-500/10"
                onClick={() => togglePause(file.id)}
              >
                <Pause className="mr-1 h-3.5 w-3.5" /> 暂停
              </Button>
            )}
            {isPaused && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-green-600 hover:bg-green-500/10"
                onClick={() => togglePause(file.id)}
              >
                <Play className="mr-1 h-3.5 w-3.5" /> 继续
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatView({
  files,
  selectedFiles,
  onSelectFile,
  isLoading,
  hasMore = false,
  onLoadMore,
  updateField,
  chatTitle,
  onViewFile,
}: ChatViewProps) {
  // Group files by date
  const groupedFiles = useMemo(() => {
    const groups: { dateLabel: string; items: TelegramFile[] }[] = [];
    const map = new Map<string, TelegramFile[]>();

    files.forEach((file) => {
      let label = "Earlier";
      if (file.date) {
        const d = new Date(file.date * 1000);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (d.toDateString() === today.toDateString()) {
          label = "今天";
        } else if (d.toDateString() === yesterday.toDateString()) {
          label = "昨天";
        } else {
          label = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
        }
      }

      if (!map.has(label)) {
        map.set(label, []);
      }
      map.get(label)!.push(file);
    });

    map.forEach((items, dateLabel) => {
      groups.push({ dateLabel, items });
    });

    return groups;
  }, [files]);

  const handleViewFile = (file: TelegramFile) => {
    if (onViewFile) {
      onViewFile(file);
    }
  };

  return (
    <div className="flex flex-col w-full space-y-6 pb-20">
      {/* Message Stream */}
      <div className="flex flex-col space-y-6 max-w-4xl mx-auto w-full px-2 sm:px-4">
        {groupedFiles.map((group) => (
          <div key={group.dateLabel} className="space-y-4">
            {/* Sticky Date Divider */}
            <div className="flex justify-center sticky top-2 z-10 my-3">
              <span className="rounded-full bg-muted/80 backdrop-blur-md px-3.5 py-1 text-xs font-medium text-muted-foreground shadow-sm border border-border/40">
                {group.dateLabel}
              </span>
            </div>

            {/* Bubble List in Group */}
            <div className="flex flex-col space-y-4 items-start sm:items-center">
              {group.items.map((file) => (
                <ChatMessageBubble
                  key={file.uniqueId || file.id}
                  file={file}
                  isSelected={selectedFiles.has(file.id)}
                  onToggleSelect={() => onSelectFile(file.id)}
                  onViewFile={handleViewFile}
                  updateField={updateField}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Load More Button */}
        {hasMore && (
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={onLoadMore}
              disabled={isLoading}
              className="gap-2"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              加载更多历史消息
            </Button>
          </div>
        )}

        {files.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <p className="text-base font-medium">当前群组无匹配文件或媒体</p>
            <p className="text-xs mt-1">请尝试在上方调整筛选条件或搜索关键词</p>
          </div>
        )}
      </div>
    </div>
  );
}
