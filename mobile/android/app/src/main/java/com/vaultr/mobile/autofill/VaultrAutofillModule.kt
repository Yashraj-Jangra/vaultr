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
            val count = AutofillCredentialStore.getCount()

            val map = Arguments.createMap().apply {
                putBoolean("isAutofillSupported", isAutofillSupported)
                putBoolean("isAutofillEnabled", isAutofillEnabled)
                putBoolean("isAccessibilityEnabled", isAccessibilityEnabled)
                putInt("credentialCount", count)
            }

            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("STATUS_ERROR", e.message, e)
        }
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
