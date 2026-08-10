package com.vaultr.mobile

import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.view.autofill.AutofillManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class VaultrAutofillModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "VaultrAutofillModule"

    @ReactMethod
    fun checkStatus(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val afm = reactContext.getSystemService(AutofillManager::class.java)
                val enabled = afm?.hasEnabledAutofillServices() ?: false
                promise.resolve(enabled)
            } else {
                promise.resolve(false)
            }
        } catch (e: Exception) {
            promise.reject("AUTOFILL_STATUS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun openSettings() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val intent = Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE).apply {
                    data = android.net.Uri.parse("package:com.vaultr.mobile")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                reactContext.startActivity(intent)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @ReactMethod
    fun syncCredentials(jsonString: String, promise: Promise) {
        try {
            val store = AutofillCredentialStore(reactContext)
            store.saveCredentials(jsonString)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("AUTOFILL_SYNC_ERROR", e.message, e)
        }
    }
}
