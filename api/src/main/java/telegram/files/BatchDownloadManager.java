package telegram.files;

import cn.hutool.core.io.FileUtil;
import cn.hutool.core.util.IdUtil;
import cn.hutool.core.util.StrUtil;
import cn.hutool.log.Log;
import cn.hutool.log.LogFactory;
import io.vertx.core.Future;
import io.vertx.core.json.JsonObject;
import telegram.files.repository.FileRecord;

import java.io.File;
import java.nio.file.Path;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/**
 * Manages batch download operations, creating subfolders in the download directory
 * and preserving file selection order by sequence prefixing.
 */
public class BatchDownloadManager {
    private static final Log log = LogFactory.get();

    private static final Pattern ILLEGAL_FILENAME_CHARS = Pattern.compile("[\\\\/:*?\"<>|\\r\\n\\t]");

    public static class BatchFileInfo {
        public final String batchId;
        public final String baseDestination;
        public final String subfolder;
        public final boolean preserveOrder;
        public final int orderIndex;
        public final int totalFiles;
        public final String preferredFileName;
        public final String caption;

        public BatchFileInfo(String batchId, String baseDestination, String subfolder, boolean preserveOrder, int orderIndex, int totalFiles) {
            this(batchId, baseDestination, subfolder, preserveOrder, orderIndex, totalFiles, null, null);
        }

        public BatchFileInfo(String batchId, String baseDestination, String subfolder, boolean preserveOrder, int orderIndex, int totalFiles, String preferredFileName, String caption) {
            this.batchId = batchId;
            this.baseDestination = baseDestination;
            this.subfolder = subfolder;
            this.preserveOrder = preserveOrder;
            this.orderIndex = orderIndex;
            this.totalFiles = totalFiles;
            this.preferredFileName = preferredFileName;
            this.caption = caption;
        }
    }

    private static final Map<String, BatchFileInfo> ACTIVE_BATCH_FILES = new ConcurrentHashMap<>();

    public static String getDefaultDownloadDir() {
        if (StrUtil.isNotBlank(Config.APP_ROOT)) {
            return Path.of(Config.APP_ROOT, "downloads").toString();
        }
        return Path.of("data", "downloads").toString();
    }

    public static String sanitizeFolderName(String name) {
        if (StrUtil.isBlank(name)) {
            return "Batch_" + IdUtil.fastSimpleUUID().substring(0, 8);
        }
        String cleaned = ILLEGAL_FILENAME_CHARS.matcher(name.trim()).replaceAll("_");
        cleaned = cleaned.replaceAll("\\s+", " ").trim();
        return StrUtil.isBlank(cleaned) ? "Batch_" + IdUtil.fastSimpleUUID().substring(0, 8) : cleaned;
    }

    public static String sanitizeFileName(String name) {
        if (StrUtil.isBlank(name)) {
            return "file";
        }
        String cleaned = ILLEGAL_FILENAME_CHARS.matcher(name.trim()).replaceAll("_");
        return StrUtil.isBlank(cleaned) ? "file" : cleaned;
    }

    public static String extractCleanTitle(String text) {
        if (StrUtil.isBlank(text)) {
            return "";
        }
        String firstLine = text.lines().findFirst().orElse("").trim();
        String cleaned = sanitizeFileName(firstLine);
        if (cleaned.length() > 60) {
            cleaned = cleaned.substring(0, 60).trim();
        }
        return cleaned;
    }

    /**
     * Register a batch download task for tracking and folder management.
     */
    public static void registerBatchFile(String uniqueId, String batchId, String baseDestination, String subfolder, boolean preserveOrder, int orderIndex, int totalFiles) {
        registerBatchFile(uniqueId, batchId, baseDestination, subfolder, preserveOrder, orderIndex, totalFiles, null, null);
    }

    public static void registerBatchFile(String uniqueId, String batchId, String baseDestination, String subfolder, boolean preserveOrder, int orderIndex, int totalFiles, String preferredFileName, String caption) {
        if (StrUtil.isBlank(uniqueId)) {
            return;
        }
        String dest = StrUtil.isNotBlank(baseDestination) ? baseDestination : getDefaultDownloadDir();
        ACTIVE_BATCH_FILES.put(uniqueId, new BatchFileInfo(batchId, dest, subfolder, preserveOrder, orderIndex, totalFiles, preferredFileName, caption));
        log.debug("Registered batch file: uniqueId={}, batchId={}, subfolder={}, orderIndex={}/{}, name={}, caption={}", uniqueId, batchId, subfolder, orderIndex, totalFiles, preferredFileName, caption);
    }

    public static boolean isBatchFile(String uniqueId) {
        return StrUtil.isNotBlank(uniqueId) && ACTIVE_BATCH_FILES.containsKey(uniqueId);
    }

    /**
     * Called when a file download completes. Copies the file into the designated subfolder
     * with order preservation if configured.
     */
    public static Future<Void> onFileDownloadCompleted(String uniqueId, String sourceLocalPath) {
        if (StrUtil.isBlank(uniqueId) || StrUtil.isBlank(sourceLocalPath)) {
            return Future.succeededFuture();
        }

        BatchFileInfo info = ACTIVE_BATCH_FILES.remove(uniqueId);
        if (info == null) {
            return Future.succeededFuture();
        }

        File originFile = new File(sourceLocalPath);
        if (!originFile.exists()) {
            log.warn("Batch file source path does not exist: {}", sourceLocalPath);
            return Future.succeededFuture();
        }

        return DataVerticle.fileRepository.getByUniqueId(uniqueId).compose(fileRecord -> {
            try {
                String baseDest = StrUtil.isNotBlank(info.baseDestination) ? info.baseDestination : getDefaultDownloadDir();
                Path targetDir;
                if (StrUtil.isNotBlank(info.subfolder)) {
                    targetDir = Path.of(baseDest, sanitizeFolderName(info.subfolder));
                } else {
                    targetDir = Path.of(baseDest);
                }

                FileUtil.mkdir(targetDir.toFile());

                String rawFileName = null;
                // 1. Check preferredFileName from client
                if (StrUtil.isNotBlank(info.preferredFileName) && !info.preferredFileName.matches("^\\d{15,}.*")) {
                    rawFileName = info.preferredFileName;
                }
                // 2. Check stored fileRecord fileName
                if (StrUtil.isBlank(rawFileName) && fileRecord != null && StrUtil.isNotBlank(fileRecord.fileName()) && !fileRecord.fileName().matches("^\\d{15,}.*")) {
                    rawFileName = fileRecord.fileName();
                }
                // 3. If still blank or numeric id, check caption (especially for photos!)
                if (StrUtil.isBlank(rawFileName)) {
                    String caption = StrUtil.isNotBlank(info.caption)
                            ? info.caption
                            : (fileRecord != null ? fileRecord.caption() : null);
                    String cleanTitle = extractCleanTitle(caption);
                    if (StrUtil.isNotBlank(cleanTitle)) {
                        String ext = FileUtil.extName(originFile.getName());
                        if (StrUtil.isBlank(ext) && fileRecord != null && "photo".equalsIgnoreCase(fileRecord.type())) {
                            ext = "jpg";
                        }
                        rawFileName = StrUtil.isNotBlank(ext)
                                ? (cleanTitle.toLowerCase().endsWith("." + ext.toLowerCase()) ? cleanTitle : cleanTitle + "." + ext)
                                : cleanTitle;
                    }
                }
                // 4. Fallback to origin file name on disk
                if (StrUtil.isBlank(rawFileName)) {
                    rawFileName = originFile.getName();
                }

                // If rawFileName is still an internal raw Telegram ID like 5359665276540537419_120.jpg
                if (rawFileName.matches("^\\d{15,}.*")) {
                    String ext = FileUtil.extName(rawFileName);
                    if (StrUtil.isBlank(ext) && fileRecord != null && "photo".equalsIgnoreCase(fileRecord.type())) {
                        ext = "jpg";
                    }
                    String base = (fileRecord != null && "photo".equalsIgnoreCase(fileRecord.type())) ? "photo" : "file";
                    rawFileName = StrUtil.isNotBlank(ext) ? base + "." + ext : base;
                }

                String cleanedFileName = sanitizeFileName(rawFileName);

                String finalFileName;
                if (info.preserveOrder) {
                    String prefix = info.totalFiles >= 100
                            ? String.format("%03d_", info.orderIndex)
                            : String.format("%02d_", info.orderIndex);
                    // Avoid duplicate sequence prefix if already prefixed (match 2 to 4 digits only, not 15+ digit IDs!)
                    if (!cleanedFileName.matches("^\\d{2,4}_.*")) {
                        finalFileName = prefix + cleanedFileName;
                    } else {
                        finalFileName = cleanedFileName;
                    }
                } else {
                    finalFileName = cleanedFileName;
                }

                Path destFilePath = targetDir.resolve(finalFileName);
                File destFile = destFilePath.toFile();

                log.info("Batch transferring file: {} -> {}", originFile.getAbsolutePath(), destFile.getAbsolutePath());
                FileUtil.copy(originFile, destFile, true);

                return DataVerticle.fileRepository.updateTransferStatus(
                        uniqueId,
                        FileRecord.TransferStatus.completed,
                        destFile.getAbsolutePath()
                ).compose(r -> {
                    // Send event for file status update
                    EventPayload payload = EventPayload.build(EventPayload.TYPE_FILE_STATUS, new JsonObject()
                            .put("uniqueId", uniqueId)
                            .put("localPath", destFile.getAbsolutePath())
                            .put("transferStatus", FileRecord.TransferStatus.completed.name())
                            .put("downloadStatus", FileRecord.DownloadStatus.completed.name())
                    );
                    TelegramVerticles.getAll().forEach(v -> v.sendEvent(payload));
                    return Future.succeededFuture();
                });
            } catch (Exception e) {
                log.error("Failed to process batch download completion for file {}: {}", uniqueId, e.getMessage(), e);
                return Future.succeededFuture();
            }
        });
    }
}
