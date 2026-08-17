package com.vaultr.mobile.autofill

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.util.LruCache
import android.view.View
import android.widget.ImageView
import android.widget.TextView
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

object FaviconLoader {
    private const val TAG = "FaviconLoader"
    private val mainHandler = Handler(Looper.getMainLooper())
    private val executor = Executors.newFixedThreadPool(4)

    // 4MB Memory Cache
    private val maxMemory = (Runtime.getRuntime().maxMemory() / 1024).toInt()
    private val cacheSize = maxMemory / 8
    private val memoryCache = object : LruCache<String, Bitmap>(cacheSize) {
        override fun sizeOf(key: String, bitmap: Bitmap): Int {
            return bitmap.byteCount / 1024
        }
    }

    fun loadFavicon(
        context: Context,
        domainOrUrl: String?,
        imageView: ImageView,
        fallbackAvatar: TextView,
        initialText: String
    ) {
        if (domainOrUrl.isNullOrBlank()) {
            imageView.visibility = View.GONE
            fallbackAvatar.visibility = View.VISIBLE
            fallbackAvatar.text = initialText
            return
        }

        val domain = AutofillCredentialStore.normalizeDomain(domainOrUrl)
        if (domain.isBlank()) {
            imageView.visibility = View.GONE
            fallbackAvatar.visibility = View.VISIBLE
            fallbackAvatar.text = initialText
            return
        }

        imageView.tag = domain

        // 1. Check memory cache
        val cached = memoryCache.get(domain)
        if (cached != null && !cached.isRecycled) {
            imageView.setImageBitmap(cached)
            imageView.visibility = View.VISIBLE
            fallbackAvatar.visibility = View.GONE
            return
        }

        // Show fallback initially while loading
        imageView.visibility = View.GONE
        fallbackAvatar.visibility = View.VISIBLE
        fallbackAvatar.text = initialText

        // 2. Fetch asynchronously
        executor.execute {
            try {
                // Check disk cache
                val diskFile = File(getDiskCacheDir(context), "${domain.replace(Regex("[^a-zA-Z0-9.-]"), "_")}.png")
                if (diskFile.exists() && diskFile.length() > 0) {
                    val bitmap = BitmapFactory.decodeFile(diskFile.absolutePath)
                    if (bitmap != null) {
                        memoryCache.put(domain, bitmap)
                        postResult(imageView, fallbackAvatar, domain, bitmap)
                        return@execute
                    }
                }

                // Download from Google Favicon Service
                val faviconUrl = "https://www.google.com/s2/favicons?domain=$domain&sz=64"
                val conn = URL(faviconUrl).openConnection() as HttpURLConnection
                conn.connectTimeout = 4000
                conn.readTimeout = 4000
                conn.instanceFollowRedirects = true

                if (conn.responseCode == HttpURLConnection.HTTP_OK) {
                    val stream = conn.inputStream
                    val bitmap = BitmapFactory.decodeStream(stream)
                    stream.close()

                    if (bitmap != null && bitmap.width > 1 && bitmap.height > 1) {
                        memoryCache.put(domain, bitmap)

                        // Save to disk cache
                        try {
                            diskFile.parentFile?.mkdirs()
                            FileOutputStream(diskFile).use { out ->
                                bitmap.compress(Bitmap.CompressFormat.PNG, 90, out)
                            }
                        } catch (_: Exception) {}

                        postResult(imageView, fallbackAvatar, domain, bitmap)
                    }
                }
            } catch (e: Exception) {
                // Silently fallback to letter monogram
            }
        }
    }

    private fun postResult(
        imageView: ImageView,
        fallbackAvatar: TextView,
        domain: String,
        bitmap: Bitmap
    ) {
        mainHandler.post {
            if (imageView.tag == domain) {
                imageView.setImageBitmap(bitmap)
                imageView.visibility = View.VISIBLE
                fallbackAvatar.visibility = View.GONE
            }
        }
    }

    private fun getDiskCacheDir(context: Context): File {
        val dir = File(context.cacheDir, "favicons")
        if (!dir.exists()) dir.mkdirs()
        return dir
    }
}
