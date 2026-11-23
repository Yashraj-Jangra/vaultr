package com.vaultr.mobile.autofill

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.view.autofill.AutofillManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import java.security.KeyPairGenerator
import java.security.SecureRandom
import java.security.spec.ECGenParameterSpec
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class VaultrAutofillModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val ACTION_AUTOFILL_UNLOCKED = "com.vaultr.mobile.AUTOFILL_UNLOCKED"
        @Volatile
        var isAutofillUnlockPending: Boolean = false
    }

    override fun getName(): String = "VaultrAutofillModule"

    @ReactMethod
    fun isAutofillUnlockPending(promise: Promise) {
        promise.resolve(isAutofillUnlockPending)
    }

    @ReactMethod
    fun finishAutofillUnlock(promise: Promise) {
        try {
            isAutofillUnlockPending = false
            val intent = Intent(ACTION_AUTOFILL_UNLOCKED).apply {
                setPackage(reactContext.packageName)
            }
            reactContext.sendBroadcast(intent)

            // Gracefully move MainActivity to the background so the user returns to the autofill flow
            reactContext.currentActivity?.moveTaskToBack(true)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("FINISH_UNLOCK_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun checkStatus(promise: Promise) {
        try {
            var isAutofillSupported = false
            var isAutofillEnabled = false

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val afm = reactContext.getSystemService(AutofillManager::class.java)
                if (afm != null) {
                    isAutofillSupported = afm.isAutofillSupported
                    isAutofillEnabled = afm.hasEnabledAutofillServices()
                }
            }

            val isAccessibilityEnabled = checkAccessibilityEnabled()
            val isCredentialManagerSupported = Build.VERSION.SDK_INT >= 34
            var isCredentialManagerEnabled = false

            if (Build.VERSION.SDK_INT >= 34) {
                try {
                    val cm = reactContext.getSystemService(android.credentials.CredentialManager::class.java)
                    if (cm != null) {
                        val component = android.content.ComponentName(reactContext, VaultrCredentialProviderService::class.java)
                        isCredentialManagerEnabled = cm.isEnabledCredentialProviderService(component)
                    }
                } catch (_: Exception) {}
            }

            val count = AutofillCredentialStore.getCount()
            val passkeys = AutofillCredentialStore.getPasskeyCount(reactContext)

            val map = Arguments.createMap().apply {
                putBoolean("isAutofillSupported", isAutofillSupported)
                putBoolean("isAutofillEnabled", isAutofillEnabled)
                putBoolean("isAccessibilityEnabled", isAccessibilityEnabled)
                putBoolean("isCredentialManagerSupported", isCredentialManagerSupported)
                putBoolean("isCredentialManagerEnabled", isCredentialManagerEnabled)
                putInt("credentialCount", count)
                putInt("passkeyCount", passkeys)
            }

            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("STATUS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun openCredentialManagerSettings() {
        if (Build.VERSION.SDK_INT >= 34) {
            try {
                // Open Android 14+ Credential Provider settings targeting Vaultr
                val intent = Intent("android.settings.CREDENTIAL_PROVIDER").apply {
                    data = Uri.parse("package:${reactContext.packageName}")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactContext.startActivity(intent)
                return
            } catch (_: Exception) {
                try {
                    val fallbackIntent = Intent("android.settings.CREDENTIAL_PROVIDER").apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    reactContext.startActivity(fallbackIntent)
                    return
                } catch (_: Exception) {}
            }
        }
        // Fallback to standard autofill provider picker
        openSettings()
    }

    @ReactMethod
    fun openSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                // Request Vaultr specifically as the autofill provider
                val intent = Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE)
                intent.data = Uri.parse("package:${reactContext.packageName}")
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactContext.startActivity(intent)
            } catch (_: Exception) {
                // Fallback to general autofill settings
                try {
                    val fallbackIntent = Intent("android.settings.AUTOFILL_SETTINGS")
                    fallbackIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    reactContext.startActivity(fallbackIntent)
                } catch (_: Exception) {
                    // Fallback to application settings
                    val appIntent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                    appIntent.data = Uri.parse("package:${reactContext.packageName}")
                    appIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    reactContext.startActivity(appIntent)
                }
            }
        }
    }

    @ReactMethod
    fun openAccessibilitySettings() {
        try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(intent)
        } catch (_: Exception) {
            val appIntent = Intent(Settings.ACTION_SETTINGS)
            appIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(appIntent)
        }
    }

    @ReactMethod
    fun syncCredentials(jsonString: String, timeoutMinutes: Double, promise: Promise) {
        try {
            val timeoutMs = if (timeoutMinutes > 0) (timeoutMinutes * 60 * 1000).toLong() else 5 * 60 * 1000L
            AutofillCredentialStore.syncCredentials(reactContext, jsonString, timeoutMs)
            val count = AutofillCredentialStore.getCount()
            val intent = Intent(ACTION_AUTOFILL_UNLOCKED).apply {
                setPackage(reactContext.packageName)
            }
            reactContext.sendBroadcast(intent)
            promise.resolve(count)
        } catch (e: Exception) {
            promise.reject("SYNC_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun recordHeartbeat(promise: Promise) {
        try {
            AutofillCredentialStore.recordHeartbeat(reactContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun clearCredentials(promise: Promise) {
        try {
            AutofillCredentialStore.clear(reactContext)
            val intent = Intent(ACTION_AUTOFILL_UNLOCKED).apply {
                setPackage(reactContext.packageName)
            }
            reactContext.sendBroadcast(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CLEAR_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun testMatch(query: String, promise: Promise) {
        try {
            val matches = AutofillCredentialStore.findMatches(query)
            val array = Arguments.createArray()
            for (m in matches) {
                val map = Arguments.createMap().apply {
                    putString("id", m.id)
                    putString("name", m.name)
                    putString("domain", m.domain)
                    putString("username", m.username)
                }
                array.pushMap(map)
            }
            promise.resolve(array)
        } catch (e: Exception) {
            promise.reject("MATCH_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getPendingPasskeys(promise: Promise) {
        try {
            val pending = AutofillCredentialStore.getPendingPasskeys(reactContext)
            val array = Arguments.createArray()
            for (item in pending) {
                val map = Arguments.createMap().apply {
                    putString("id", item.id)
                    putString("name", item.name)
                    putString("domain", item.domain ?: "")
                    putString("username", item.username)
                    putString("password", item.password)
                    putBoolean("isPasskey", item.isPasskey)
                    putString("passkeyRpId", item.passkeyRpId ?: "")
                    putString("passkeyCredentialId", item.passkeyCredentialId ?: "")
                    putString("passkeyUserHandle", item.passkeyUserHandle ?: "")
                    putString("passkeyPrivateKey", item.passkeyPrivateKey ?: "")
                    putDouble("passkeySignCount", item.passkeySignCount.toDouble())
                    val transports = Arguments.createArray()
                    item.passkeyTransports.forEach { transports.pushString(it) }
                    putArray("passkeyTransports", transports)
                }
                array.pushMap(map)
            }
            promise.resolve(array)
        } catch (e: Exception) {
            promise.reject("PENDING_PASSKEYS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun acknowledgePendingPasskeys(ids: ReadableArray, promise: Promise) {
        try {
            val idList = mutableListOf<String>()
            for (i in 0 until ids.size()) {
                val id = ids.getString(i)
                if (!id.isNullOrBlank()) idList.add(id)
            }
            AutofillCredentialStore.acknowledgePendingPasskeys(idList, reactContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ACK_PENDING_PASSKEYS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun generatePasskey(rpId: String, userName: String, promise: Promise) {
        try {
            val kpg = KeyPairGenerator.getInstance("EC")
            kpg.initialize(ECGenParameterSpec("secp256r1"))
            val keyPair = kpg.generateKeyPair()
            val privKey = keyPair.private
            val privKeyBytes = privKey.encoded // PKCS#8 format
            val privKeyB64Url = PasskeyAuthActivity.encodeBase64Url(privKeyBytes)

            val credIdBytes = ByteArray(32)
            SecureRandom().nextBytes(credIdBytes)
            val credIdB64Url = PasskeyAuthActivity.encodeBase64Url(credIdBytes)

            val userHandleBytes = ByteArray(16)
            SecureRandom().nextBytes(userHandleBytes)
            val userHandleB64Url = PasskeyAuthActivity.encodeBase64Url(userHandleBytes)

            val effectiveRpId = if (rpId.isNotBlank()) rpId else "vaultr.app"
            val effectiveUsername = if (userName.isNotBlank()) userName else ""

            val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }.format(Date())

            val map = Arguments.createMap().apply {
                putBoolean("isPasskey", true)
                putString("passkeyRpId", effectiveRpId)
                putString("passkeyCredentialId", credIdB64Url)
                putString("passkeyUserHandle", userHandleB64Url)
                putString("passkeyPrivateKey", privKeyB64Url)
                putDouble("passkeySignCount", 0.0)
                val transports = Arguments.createArray().apply {
                    pushString("internal")
                    pushString("hybrid")
                }
                putArray("passkeyTransports", transports)
                putString("passkeyCreatedAt", nowIso)
                putString("username", effectiveUsername)
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("PASSKEY_GEN_ERROR", e.message, e)
        }
    }

    private fun checkAccessibilityEnabled(): Boolean {
        return try {
            val enabledServices = Settings.Secure.getString(
                reactContext.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            ) ?: ""
            val serviceName = "${reactContext.packageName}/${VaultrAccessibilityService::class.java.name}"
            enabledServices.contains(serviceName) || enabledServices.contains(VaultrAccessibilityService::class.java.simpleName)
        } catch (_: Exception) {
            false
        }
    }
}
