package expo.modules.burntext

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.Effect
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.effect.BitmapOverlay
import androidx.media3.effect.OverlayEffect
import androidx.media3.effect.TextureOverlay
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
import com.google.common.collect.ImmutableList
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import kotlin.math.max

// Burns a transparent PNG (the edit canvas' text layer, rendered at the
// canvas' own size) into a video's pixels. The video was shown in the editor
// with "cover" fit, so the PNG is mapped back into video-frame space with
// the same cover math before being handed to Media3 as a full-frame overlay.
class BurnTextModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BurnText")

    AsyncFunction("burn") { videoUri: String, overlayUri: String, promise: Promise ->
      val context = appContext.reactContext
        ?: throw CodedException("ERR_NO_CONTEXT", "React context unavailable", null)

      try {
        val video = Uri.parse(videoUri)
        val retriever = MediaMetadataRetriever()
        var frameW = 0
        var frameH = 0
        try {
          retriever.setDataSource(context, video)
          frameW = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)!!.toInt()
          frameH = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)!!.toInt()
          val rotation = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
          if (rotation == 90 || rotation == 270) {
            val t = frameW; frameW = frameH; frameH = t
          }
        } finally {
          retriever.release()
        }

        val overlay = context.contentResolver.openInputStream(Uri.parse(overlayUri))?.use {
          BitmapFactory.decodeStream(it)
        } ?: throw CodedException("ERR_OVERLAY", "Could not read overlay image", null)

        // Canvas pixel -> video pixel, inverse of a "cover" fit.
        val s = max(overlay.width.toFloat() / frameW, overlay.height.toFloat() / frameH)
        val matrix = Matrix().apply {
          postScale(1f / s, 1f / s)
          postTranslate((frameW - overlay.width / s) / 2f, (frameH - overlay.height / s) / 2f)
        }
        val frame = Bitmap.createBitmap(frameW, frameH, Bitmap.Config.ARGB_8888)
        Canvas(frame).drawBitmap(overlay, matrix, Paint(Paint.FILTER_BITMAP_FLAG))
        overlay.recycle()

        val output = File(context.cacheDir, "burned_${System.currentTimeMillis()}.mp4")
        val bitmapOverlay: TextureOverlay = BitmapOverlay.createStaticBitmapOverlay(frame)
        val overlayEffect: Effect = OverlayEffect(ImmutableList.of(bitmapOverlay))
        val effects = Effects(emptyList<AudioProcessor>(), listOf(overlayEffect))
        val item = EditedMediaItem.Builder(MediaItem.fromUri(video)).setEffects(effects).build()

        // Transformer needs a thread with a Looper.
        Handler(Looper.getMainLooper()).post {
          val transformer = Transformer.Builder(context)
            .setVideoMimeType(MimeTypes.VIDEO_H264)
            .setAudioMimeType(MimeTypes.AUDIO_AAC)
            .addListener(object : Transformer.Listener {
              override fun onCompleted(composition: Composition, exportResult: ExportResult) {
                promise.resolve(Uri.fromFile(output).toString())
              }

              override fun onError(
                composition: Composition,
                exportResult: ExportResult,
                exportException: ExportException
              ) {
                promise.reject(CodedException("ERR_BURN", exportException.message ?: "Export failed", exportException))
              }
            })
            .build()
          transformer.start(item, output.absolutePath)
        }
      } catch (e: Exception) {
        promise.reject(CodedException("ERR_BURN", e.message ?: "Burn failed", e))
      }
    }
  }
}
