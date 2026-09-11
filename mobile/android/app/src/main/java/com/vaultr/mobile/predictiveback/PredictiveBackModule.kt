package com.vaultr.mobile.predictiveback

import android.os.Build
import android.util.Log
import android.window.BackEvent
import android.window.OnBackAnimationCallback
import android.window.OnBackInvokedDispatcher
import androidx.annotation.RequiresApi
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class PredictiveBackModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val TAG = "PredictiveBack"
    private var animCallback: Any? = null
    private var isRegistered = false

    override fun getName(): String = "PredictiveBackModule"

    @ReactMethod
    fun setEnabled(enabled: Boolean) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            return
        }

        val activity = reactContext.currentActivity ?: return
        activity.runOnUiThread {
            if (enabled) {
                registerCallback(activity)
            } else {
                unregisterCallback(activity)
            }
        }
    }

    @RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
    private fun registerCallback(activity: android.app.Activity) {
        if (isRegistered) return

        val callback = object : OnBackAnimationCallback {
            override fun onBackStarted(backEvent: BackEvent) {
                val params = Arguments.createMap().apply {
                    putInt("swipeEdge", backEvent.swipeEdge)
                    putDouble("touchX", backEvent.touchX.toDouble())
                    putDouble("touchY", backEvent.touchY.toDouble())
                    putDouble("progress", 0.0)
                }
                sendEvent("onPredictiveBackStarted", params)
            }

            override fun onBackProgressed(backEvent: BackEvent) {
                val params = Arguments.createMap().apply {
                    putDouble("progress", backEvent.progress.toDouble())
                    putInt("swipeEdge", backEvent.swipeEdge)
                    putDouble("touchX", backEvent.touchX.toDouble())
                    putDouble("touchY", backEvent.touchY.toDouble())
                }
                sendEvent("onPredictiveBackProgressed", params)
            }

            override fun onBackInvoked() {
                sendEvent("onPredictiveBackInvoked", Arguments.createMap())
            }

            override fun onBackCancelled() {
                sendEvent("onPredictiveBackCancelled", Arguments.createMap())
            }
        }

        animCallback = callback
        try {
            activity.onBackInvokedDispatcher.registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_OVERLAY,
                callback
            )
            isRegistered = true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to register callback", e)
        }
    }

    @RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
    private fun unregisterCallback(activity: android.app.Activity) {
        if (!isRegistered) return
        val callback = animCallback as? OnBackAnimationCallback ?: return
        try {
            activity.onBackInvokedDispatcher.unregisterOnBackInvokedCallback(callback)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to unregister callback", e)
        }
        animCallback = null
        isRegistered = false
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        }
    }
}
