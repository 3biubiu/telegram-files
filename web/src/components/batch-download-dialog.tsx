"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowDown,
  ArrowUp,
  Download,
  FileText,
  Film,
  FolderPlus,
  Image as ImageIcon,
  Music,
  ListOrdered,
} from "lucide-react";
import prettyBytes from "pretty-bytes";
import { type TelegramFile } from "@/lib/types";
import { useMaybeTelegramChat } from "@/hooks/use-telegram-chat";

interface BatchDownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: TelegramFile[];
  onConfirm: (options: {
    subfolder?: string;
    preserveOrder: boolean;
    orderedFiles: TelegramFile[];
  }) => void;
  isMutating?: boolean;
}

export default function BatchDownloadDialog({
  open,
  onOpenChange,
  files,
  onConfirm,
  isMutating = false,
}: BatchDownloadDialogProps) {
  const [createSubfolder, setCreateSubfolder] = useState(true);
  const [preserveOrder, setPreserveOrder] = useState(true);

  // Get chat name if available to generate a friendly default folder name
  const { chat } = useMaybeTelegramChat() ?? {};

  const defaultFolderName = useMemo(() => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    const rawChatName = chat?.name ?? "Telegram_Batch";
    const safeChatName = rawChatName.replace(/[\\/:*?"<>|\r\n\t]/g, "_").trim();
    return `${safeChatName}_${dateStr}`;
  }, [chat?.name]);

  const [subfolderName, setSubfolderName] = useState("");

  // Sync subfolderName when dialog opens or default changes
  React.useEffect(() => {
    if (open) {
      setSubfolderName(defaultFolderName);
    }
  }, [open, defaultFolderName]);
  const [orderedFileList, setOrderedFileList] = useState<TelegramFile[]>(files);

  // Sync orderedFileList when files change
  React.useEffect(() => {
    setOrderedFileList(files);
  }, [files]);

  const totalSize = useMemo(() => {
    return files.reduce((acc, f) => acc + (f.size || 0), 0);
  }, [files]);

  const moveItem = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= orderedFileList.length) return;
    const updated = [...orderedFileList];
    const [moved] = updated.splice(index, 1);
    if (moved) {
      updated.splice(newIndex, 0, moved);
      setOrderedFileList(updated);
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case "photo":
        return <ImageIcon className="h-4 w-4 text-sky-500 shrink-0" />;
      case "video":
        return <Film className="h-4 w-4 text-purple-500 shrink-0" />;
      case "audio":
        return <Music className="h-4 w-4 text-amber-500 shrink-0" />;
      default:
        return <FileText className="h-4 w-4 text-emerald-500 shrink-0" />;
    }
  };

  const handleStartDownload = () => {
    onConfirm({
      subfolder: createSubfolder && subfolderName.trim() ? subfolderName.trim() : undefined,
      preserveOrder,
      orderedFiles: orderedFileList,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="shrink-0 pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Download className="h-5 w-5 text-primary" />
            批量下载配置 ({orderedFileList.length} 个文件)
          </DialogTitle>
          <DialogDescription>
            总大小: <span className="font-semibold text-foreground">{prettyBytes(totalSize)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1 py-2">
          {/* Option: Create Subfolder */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="create-subfolder"
                checked={createSubfolder}
                onCheckedChange={(checked) => setCreateSubfolder(!!checked)}
              />
              <Label htmlFor="create-subfolder" className="font-medium cursor-pointer flex items-center gap-1.5">
                <FolderPlus className="h-4 w-4 text-primary" />
                在当前下载目录新建子文件夹存放此批下载
              </Label>
            </div>

            {createSubfolder && (
              <div className="space-y-1.5 pl-6 pt-1">
                <Label htmlFor="subfolder-name" className="text-xs text-muted-foreground">
                  子文件夹名称
                </Label>
                <Input
                  id="subfolder-name"
                  value={subfolderName}
                  onChange={(e) => setSubfolderName(e.target.value)}
                  placeholder="请输入新建文件夹名称"
                  className="h-9"
                />
              </div>
            )}
          </div>

          {/* Option: Preserve Order */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="preserve-order"
                checked={preserveOrder}
                onCheckedChange={(checked) => setPreserveOrder(!!checked)}
              />
              <Label htmlFor="preserve-order" className="font-medium cursor-pointer flex items-center gap-1.5">
                <ListOrdered className="h-4 w-4 text-primary" />
                保持勾选顺序（文件名添加序号前缀，如 01_xxx）
              </Label>
            </div>
            <p className="text-xs text-muted-foreground pl-6">
              通过在文件名前追加数字序号（01_、02_...），确保在文件管理器、播放器和NAS中严格按勾选顺序排列。
            </p>
          </div>

          {/* Files Preview in Order */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>下载顺序预览 ({orderedFileList.length})</span>
              <span>可通过右侧按钮微调顺序</span>
            </div>
            <div className="max-h-56 overflow-y-auto rounded-md border divide-y bg-background">
              {orderedFileList.map((file, idx) => {
                const seq = orderedFileList.length >= 100
                  ? String(idx + 1).padStart(3, "0")
                  : String(idx + 1).padStart(2, "0");
                const cleanCaption = file.caption
                  ? (file.caption.split("\n")[0]?.trim().replace(/[<>:"/\\|?*]/g, "_") ?? "")
                  : "";
                const baseDisplayName =
                  file.fileName ||
                  (cleanCaption
                    ? cleanCaption.toLowerCase().endsWith(".jpg")
                      ? cleanCaption
                      : `${cleanCaption}.jpg`
                    : file.type === "photo"
                      ? "photo.jpg"
                      : "file");
                const previewName = preserveOrder
                  ? `${seq}_${baseDisplayName}`
                  : baseDisplayName;

                return (
                  <div
                    key={file.uniqueId || file.id}
                    className="flex items-center justify-between px-3 py-2 text-xs hover:bg-muted/40 transition-colors gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="font-mono text-muted-foreground w-6 shrink-0">{seq}.</span>
                      {getFileIcon(file.type)}
                      <span className="truncate font-medium">{previewName}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-muted-foreground">{prettyBytes(file.size || 0)}</span>
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={idx === 0}
                          onClick={() => moveItem(idx, "up")}
                          title="上移"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={idx === orderedFileList.length - 1}
                          onClick={() => moveItem(idx, "down")}
                          title="下移"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 pt-3 border-t flex sm:justify-between items-center">
          <div className="text-xs text-muted-foreground">
            已选择 <span className="font-semibold text-foreground">{orderedFileList.length}</span> 个文件
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button size="sm" onClick={handleStartDownload} disabled={isMutating}>
              <Download className="mr-1.5 h-4 w-4" />
              开始下载
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
