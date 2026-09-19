package com.vaultr.mobile.autofill

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.net.URI

data class AutofillItem(
    val id: String,
    val name: String,
    val domain: String?,
    val username: String,
    val password: String,
    val urls: List<String> = emptyList(),
    val isPasskey: Boolean = false,
    val passkeyRpId: String? = null,
    val passkeyCredentialId: String? = null,
    val passkeyUserHandle: String? = null,
    val passkeyPrivateKey: String? = null,
    val passkeySignCount: Long = 0L,
    val passkeyTransports: List<String> = emptyList()
)

object AutofillCredentialStore {
    private const val TAG = "VaultrAutofillStore"
    private const val PREFS_NAME = "vaultr_autofill_secure_cache"
    private const val KEY_CREDENTIALS = "cached_credentials_json"
    private const val KEY_UNLOCKED_AT = "vaultr_autofill_unlocked_at"
    private const val KEY_TIMEOUT_MS = "vaultr_autofill_timeout_ms"
    private const val DEFAULT_TIMEOUT_MS = 5 * 60 * 1000L // 5 minutes default

    // In-memory cache for ultra-fast matching
    @Volatile
    private var cachedItems: List<AutofillItem> = emptyList()
    @Volatile
    private var lastUnlockedAt: Long = 0L
    @Volatile
    private var autoLockTimeoutMs: Long = DEFAULT_TIMEOUT_MS

    // Common Android package to web domain mapping table
    private val PACKAGE_DOMAIN_MAP = mapOf(
        "com.google.android.gm" to "google.com",
        "com.google.android.youtube" to "youtube.com",
        "com.google.android.apps.docs" to "google.com",
        "com.twitter.android" to "twitter.com",
        "com.facebook.katana" to "facebook.com",
        "com.facebook.orca" to "messenger.com",
        "com.instagram.android" to "instagram.com",
        "com.spotify.music" to "spotify.com",
        "com.discord" to "discord.com",
        "org.telegram.messenger" to "telegram.org",
        "com.reddit.frontpage" to "reddit.com",
        "com.netflix.mediaclient" to "netflix.com",
        "com.amazon.mShop.android.shopping" to "amazon.com",
        "com.github.android" to "github.com",
        "com.linkedin.android" to "linkedin.com",
        "com.pinterest" to "pinterest.com",
        "tv.twitch.android.app" to "twitch.tv",
        "com.zhiliaoapp.musically" to "tiktok.com",
        "com.snapchat.android" to "snapchat.com",
        "com.whatsapp" to "whatsapp.com",
        "com.slack" to "slack.com",
        "com.dropbox.android" to "dropbox.com",
        "com.valvesoftware.android.steam.community" to "steampowered.com",
        "com.epicgames.portal" to "epicgames.com",
        "com.uber.uberx" to "uber.com",
        "com.paypal.android.p2pmobile" to "paypal.com"
    )

    fun initialize(context: Context) {
        try {
            val prefs = getPrefs(context)
            lastUnlockedAt = prefs.getLong(KEY_UNLOCKED_AT, 0L)
            autoLockTimeoutMs = prefs.getLong(KEY_TIMEOUT_MS, DEFAULT_TIMEOUT_MS)

            // If never unlocked or auto-lock timeout has expired, wipe immediately
            if (lastUnlockedAt == 0L) {
                clear(context)
                return
            }

            if (autoLockTimeoutMs > 0L) {
                val elapsed = System.currentTimeMillis() - lastUnlockedAt
                if (elapsed >= autoLockTimeoutMs) {
                    Log.d(TAG, "Auto-lock timeout expired ($elapsed >= $autoLockTimeoutMs ms). Vault is locked.")
                    clear(context)
                    return
                }
            }

            if (cachedItems.isEmpty()) {
                val raw = prefs.getString(KEY_CREDENTIALS, null)
                if (!raw.isNullOrBlank()) {
                    cachedItems = parseJson(raw)
                    Log.d(TAG, "Loaded ${cachedItems.size} credentials from local store")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize credentials from store", e)
        }
    }

    fun isVaultLocked(): Boolean {
        return isVaultLockedInternal()
    }

    private fun isVaultLockedInternal(): Boolean {
        if (lastUnlockedAt == 0L) return true
        if (autoLockTimeoutMs > 0L && lastUnlockedAt > 0L) {
            val elapsed = System.currentTimeMillis() - lastUnlockedAt
            if (elapsed >= autoLockTimeoutMs) {
                Log.d(TAG, "Auto-lock timeout expired ($elapsed >= $autoLockTimeoutMs ms). Vault is locked.")
                cachedItems = emptyList()
                lastUnlockedAt = 0L
                return true
            }
        }
        return cachedItems.isEmpty()
    }

    fun syncCredentials(context: Context, jsonString: String, timeoutMs: Long = DEFAULT_TIMEOUT_MS) {
        try {
            val items = parseJson(jsonString)
            cachedItems = items
            lastUnlockedAt = System.currentTimeMillis()
            autoLockTimeoutMs = if (timeoutMs > 0) timeoutMs else DEFAULT_TIMEOUT_MS

            val prefs = getPrefs(context)
            prefs.edit()
                .putString(KEY_CREDENTIALS, jsonString)
                .putLong(KEY_UNLOCKED_AT, lastUnlockedAt)
                .putLong(KEY_TIMEOUT_MS, autoLockTimeoutMs)
                .apply()
            Log.d(TAG, "Successfully synced ${items.size} credentials. Timeout: ${autoLockTimeoutMs}ms")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to sync credentials", e)
        }
    }

    fun recordHeartbeat(context: Context) {
        if (cachedItems.isNotEmpty()) {
            lastUnlockedAt = System.currentTimeMillis()
            try {
                getPrefs(context).edit().putLong(KEY_UNLOCKED_AT, lastUnlockedAt).apply()
            } catch (_: Exception) {}
        }
    }

    fun clear(context: Context) {
        cachedItems = emptyList()
        lastUnlockedAt = 0L
        try {
            val prefs = getPrefs(context)
            prefs.edit()
                .remove(KEY_CREDENTIALS)
                .remove(KEY_UNLOCKED_AT)
                .apply()
            Log.d(TAG, "Wiped autofill credential store")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to clear credentials", e)
        }
    }

    fun getCount(): Int {
        if (isVaultLocked()) return 0
        return cachedItems.size
    }

    fun getAll(): List<AutofillItem> {
        if (isVaultLocked()) return emptyList()
        return cachedItems
    }

    /**
     * Finds matching credentials by target domain, URL, or native Android package name.
     */
    fun findMatches(target: String?): List<AutofillItem> {
        if (isVaultLocked() || target.isNullOrBlank()) return emptyList()

        val cleanTarget = normalizeDomain(target)
        val mappedDomain = PACKAGE_DOMAIN_MAP[target.trim().lowercase()]

        val matches = mutableListOf<AutofillItem>()

        for (item in cachedItems) {
            // 1. Direct domain match
            if (!item.domain.isNullOrBlank()) {
                val itemDomain = normalizeDomain(item.domain)
                if (itemDomain == cleanTarget || (mappedDomain != null && itemDomain == mappedDomain)) {
                    matches.add(item)
                    continue
                }
                // Subdomain or suffix matching (e.g. accounts.google.com <-> google.com)
                if (cleanTarget.endsWith(".$itemDomain") || itemDomain.endsWith(".$cleanTarget")) {
                    matches.add(item)
                    continue
                }
            }

            // 2. Additional URLs match
            var urlMatched = false
            for (u in item.urls) {
                val uDomain = normalizeDomain(u)
                if (uDomain == cleanTarget || (mappedDomain != null && uDomain == mappedDomain)) {
                    matches.add(item)
                    urlMatched = true
                    break
                }
            }
            if (urlMatched) continue

            // 3. Fallback: package name in domain field (e.g. androidapp://com.example.app)
            if (item.domain?.startsWith("androidapp:") == true) {
                val pkg = item.domain.removePrefix("androidapp:").trim()
                if (pkg.equals(target, ignoreCase = true)) {
                    matches.add(item)
                    continue
                }
            }

            // 4. Name fuzzy match for native apps
            val cleanName = item.name.trim().lowercase().replace(Regex("[^a-z0-9]"), "")
            val cleanTargetKey = cleanTarget.replace(Regex("[^a-z0-9]"), "")
            if (cleanName.length >= 3 && cleanTargetKey.contains(cleanName)) {
                matches.add(item)
            }
        }

        return matches.distinctBy { it.id }
    }

    fun normalizeDomain(input: String): String {
        var clean = input.trim().lowercase()
        // Remove androidapp: scheme
        if (clean.startsWith("androidapp://")) {
            clean = clean.removePrefix("androidapp://")
        } else if (clean.startsWith("androidapp:")) {
            clean = clean.removePrefix("androidapp:")
        }
        // Remove http/https
        if (clean.startsWith("http://") || clean.startsWith("https://")) {
            try {
                val uri = URI(clean)
                clean = uri.host ?: clean
            } catch (_: Exception) {
                clean = clean.replace(Regex("^https?://"), "")
            }
        }
        // Remove port and path
        clean = clean.split("/")[0].split(":")[0].split("?")[0].split("#")[0]
        // Strip www. prefix
        if (clean.startsWith("www.")) {
            clean = clean.removePrefix("www.")
        }
        return clean
    }

    fun getPasskeyCount(): Int {
        if (isVaultLocked()) return 0
        return cachedItems.count { it.isPasskey && !it.passkeyCredentialId.isNullOrBlank() }
    }

    fun findPasskeys(rpId: String?): List<AutofillItem> {
        if (isVaultLocked() || rpId.isNullOrBlank()) return emptyList()
        val cleanRp = normalizeDomain(rpId)
        val mappedDomain = PACKAGE_DOMAIN_MAP[cleanRp.lowercase()]
        return cachedItems.filter { item ->
            if (!item.isPasskey || item.passkeyCredentialId.isNullOrBlank()) return@filter false

            val itemRp = item.passkeyRpId?.takeIf { it.isNotBlank() }?.let { normalizeDomain(it) }
            val itemDomain = item.domain?.takeIf { it.isNotBlank() }?.let { normalizeDomain(it) }

            // 1. Direct match on RP ID or domain
            if (itemRp == cleanRp || itemDomain == cleanRp) return@filter true
            if (mappedDomain != null && (itemRp == mappedDomain || itemDomain == mappedDomain)) return@filter true

            // 2. Subdomain / parent domain match (e.g. login.live.com vs live.com)
            if (itemRp != null && (cleanRp.endsWith(".$itemRp") || itemRp.endsWith(".$cleanRp"))) return@filter true
            if (itemDomain != null && (cleanRp.endsWith(".$itemDomain") || itemDomain.endsWith(".$cleanRp"))) return@filter true

            // 3. URLs match
            for (u in item.urls) {
                val uDomain = normalizeDomain(u)
                if (uDomain == cleanRp || (mappedDomain != null && uDomain == mappedDomain)) return@filter true
                if (cleanRp.endsWith(".$uDomain") || uDomain.endsWith(".$cleanRp")) return@filter true
            }

            false
        }
    }

    fun findPasskeyByCredentialId(credentialId: String): AutofillItem? {
        if (isVaultLocked()) return null
        return cachedItems.firstOrNull { it.isPasskey && (it.passkeyCredentialId == credentialId || it.id == credentialId) }
    }

    fun updatePasskeySignCount(credentialId: String, newCount: Long, context: Context? = null) {
        val index = cachedItems.indexOfFirst { it.passkeyCredentialId == credentialId || it.id == credentialId }
        if (index != -1) {
            val item = cachedItems[index]
            val updated = item.copy(passkeySignCount = newCount)
            val newList = cachedItems.toMutableList()
            newList[index] = updated
            cachedItems = newList

            if (context != null) {
                try {
                    val raw = serializeToJson(cachedItems)
                    getPrefs(context).edit().putString(KEY_CREDENTIALS, raw).apply()
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to persist updated signCount", e)
                }
            }
        }
    }

    private fun serializeToJson(items: List<AutofillItem>): String {
        val array = JSONArray()
        for (item in items) {
            val obj = JSONObject().apply {
                put("id", item.id)
                put("name", item.name)
                if (!item.domain.isNullOrBlank()) put("domain", item.domain)
                put("username", item.username)
                put("password", item.password)
                put("urls", JSONArray(item.urls))
                put("isPasskey", item.isPasskey)
                if (!item.passkeyRpId.isNullOrBlank()) put("passkeyRpId", item.passkeyRpId)
                if (!item.passkeyCredentialId.isNullOrBlank()) put("passkeyCredentialId", item.passkeyCredentialId)
                if (!item.passkeyUserHandle.isNullOrBlank()) put("passkeyUserHandle", item.passkeyUserHandle)
                if (!item.passkeyPrivateKey.isNullOrBlank()) put("passkeyPrivateKey", item.passkeyPrivateKey)
                put("passkeySignCount", item.passkeySignCount)
                put("passkeyTransports", JSONArray(item.passkeyTransports))
            }
            array.put(obj)
        }
        return array.toString()
    }

    private fun parseJson(jsonString: String): List<AutofillItem> {
        val list = mutableListOf<AutofillItem>()
        val array = JSONArray(jsonString)
        for (i in 0 until array.length()) {
            val obj = array.getJSONObject(i)
            val id = obj.optString("id", "item_$i")
            val name = obj.optString("name", "Account")
            val domain = obj.optString("domain", "").takeIf { it.isNotBlank() }
            val username = obj.optString("username", "")
            val password = obj.optString("password", "")

            val urlsList = mutableListOf<String>()
            val urlsArr = obj.optJSONArray("urls")
            if (urlsArr != null) {
                for (j in 0 until urlsArr.length()) {
                    val u = urlsArr.optString(j)
                    if (!u.isNullOrBlank()) urlsList.add(u)
                }
            }

            val isPasskey = obj.optBoolean("isPasskey", false) || obj.optString("passkeyCredentialId").isNotBlank()
            val passkeyRpId = obj.optString("passkeyRpId", "").takeIf { it.isNotBlank() } ?: domain
            val passkeyCredentialId = obj.optString("passkeyCredentialId", "").takeIf { it.isNotBlank() }
            val passkeyUserHandle = obj.optString("passkeyUserHandle", "").takeIf { it.isNotBlank() }
            val passkeyPrivateKey = obj.optString("passkeyPrivateKey", "").takeIf { it.isNotBlank() }
            val passkeySignCount = obj.optLong("passkeySignCount", 0L)

            val transportsList = mutableListOf<String>()
            val transportsArr = obj.optJSONArray("passkeyTransports")
            if (transportsArr != null) {
                for (j in 0 until transportsArr.length()) {
                    val t = transportsArr.optString(j)
                    if (!t.isNullOrBlank()) transportsList.add(t)
                }
            }

            if (username.isNotEmpty() || password.isNotEmpty() || isPasskey) {
                list.add(
                    AutofillItem(
                        id = id,
                        name = name,
                        domain = domain,
                        username = username,
                        password = password,
                        urls = urlsList,
                        isPasskey = isPasskey,
                        passkeyRpId = passkeyRpId,
                        passkeyCredentialId = passkeyCredentialId,
                        passkeyUserHandle = passkeyUserHandle,
                        passkeyPrivateKey = passkeyPrivateKey,
                        passkeySignCount = passkeySignCount,
                        passkeyTransports = transportsList
                    )
                )
            }
        }
        return list
    }

    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }
}
