package com.vaultr.mobile.autofill

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Base64
import android.util.Log
import androidx.annotation.RequiresApi
import androidx.credentials.GetCredentialResponse
import androidx.credentials.GetPublicKeyCredentialOption
import androidx.credentials.PasswordCredential
import androidx.credentials.PublicKeyCredential
import androidx.credentials.exceptions.GetCredentialUnknownException
import androidx.credentials.provider.PendingIntentHandler
import org.json.JSONObject
import java.nio.ByteBuffer
import java.security.KeyFactory
import java.security.MessageDigest
import java.security.Signature
import java.security.spec.PKCS8EncodedKeySpec

/**
 * PasskeyAuthActivity — System Credential Manager Assertion Bridge.
 *
 * Transparent activity triggered when the user selects a VaultR passkey or password candidate
 * in the Android Credential Manager bottom sheet. Performs standard ECDSA P-256 assertion signing
 * and returns the authenticated credentials directly to Android OS via PendingIntentHandler.
 */
@RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
class PasskeyAuthActivity : Activity() {

    companion object {
        private const val TAG = "VaultrPasskeyAuth"

        // Fixed ASN.1 PKCS#8 prefix for SECP256R1 (ECDSA P-256) private key wrapping
        private val PKCS8_P256_PREFIX = byteArrayOf(
            0x30.toByte(), 0x41.toByte(), 0x02.toByte(), 0x01.toByte(), 0x00.toByte(), 0x30.toByte(),
            0x13.toByte(), 0x06.toByte(), 0x07.toByte(), 0x2a.toByte(), 0x86.toByte(), 0x48.toByte(),
            0xce.toByte(), 0x3d.toByte(), 0x02.toByte(), 0x01.toByte(), 0x06.toByte(), 0x08.toByte(),
            0x2a.toByte(), 0x86.toByte(), 0x48.toByte(), 0xce.toByte(), 0x3d.toByte(), 0x03.toByte(),
            0x01.toByte(), 0x07.toByte(), 0x04.toByte(), 0x27.toByte(), 0x30.toByte(), 0x25.toByte(),
            0x02.toByte(), 0x01.toByte(), 0x01.toByte(), 0x04.toByte(), 0x20.toByte()
        )

        fun decodeBase64Flexible(input: String): ByteArray {
            var sanitized = input.trim().replace('-', '+').replace('_', '/')
            while (sanitized.length % 4 != 0) {
                sanitized += "="
            }
            return Base64.decode(sanitized, Base64.DEFAULT)
        }

        fun encodeBase64Url(bytes: ByteArray): String {
            return Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING).trim()
        }

        fun decodePrivateKey(rawKey: String): ByteArray {
            var cleaned = rawKey.trim()
            if (cleaned.contains("-----BEGIN")) {
                cleaned = cleaned.replace("-----BEGIN [A-Z0-9 ]+-----".toRegex(), "")
                    .replace("-----END [A-Z0-9 ]+-----".toRegex(), "")
                    .replace("\\s+".toRegex(), "")
            }
            val keyBytes = decodeBase64Flexible(cleaned)
            return if (keyBytes.size == 32) {
                PKCS8_P256_PREFIX + keyBytes
            } else {
                keyBytes
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        try {
            AutofillCredentialStore.initialize(applicationContext)

            val action = intent.action
            Log.d(TAG, "PasskeyAuthActivity launched with action: $action")

            when (action) {
                VaultrCredentialProviderService.ACTION_PASSKEY_AUTH -> handlePasskeyAuth()
                VaultrCredentialProviderService.ACTION_PASSWORD_AUTH -> handlePasswordAuth()
                else -> {
                    Log.w(TAG, "Unknown action: $action")
                    finishWithFailure("Unknown credential action: $action")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Fatal error in PasskeyAuthActivity", e)
            finishWithFailure(e.message ?: "Authentication error")
        }
    }

    private fun handlePasskeyAuth() {
        val resultIntent = Intent()

        // 1. Retrieve system request from framework if present
        val getRequest = PendingIntentHandler.retrieveProviderGetCredentialRequest(intent)
        val publicKeyOption = getRequest?.credentialOptions?.filterIsInstance<GetPublicKeyCredentialOption>()?.firstOrNull()

        val credentialId = intent.getStringExtra(VaultrCredentialProviderService.EXTRA_CREDENTIAL_ID) ?: ""
        val passkeyId = intent.getStringExtra(VaultrCredentialProviderService.EXTRA_PASSKEY_ID) ?: ""
        var rpId = intent.getStringExtra(VaultrCredentialProviderService.EXTRA_RP_ID) ?: ""
        val callingPkg = getRequest?.callingAppInfo?.packageName
            ?: intent.getStringExtra(VaultrCredentialProviderService.EXTRA_CALLING_PACKAGE)
            ?: ""

        // 2. Find matching passkey item in store
        var item: AutofillItem? = null
        if (passkeyId.isNotBlank()) {
            item = AutofillCredentialStore.findPasskeyByCredentialId(passkeyId)
        }
        if (item == null && credentialId.isNotBlank()) {
            item = AutofillCredentialStore.getAll().find { it.id == credentialId || it.passkeyCredentialId == credentialId }
        }

        if (item == null || item.passkeyPrivateKey.isNullOrBlank()) {
            Log.e(TAG, "Passkey item not found or missing private key for credentialId: $credentialId / passkeyId: $passkeyId")
            finishWithFailure("Passkey private key not available or vault locked")
            return
        }

        if (rpId.isBlank()) {
            rpId = item.passkeyRpId ?: item.domain ?: ""
        }

        // 3. Extract request JSON, challenge, and clientDataHash
        val requestJson = publicKeyOption?.requestJson
            ?: intent.getStringExtra(VaultrCredentialProviderService.EXTRA_REQUEST_JSON)
            ?: ""
        val clientDataHashFromOption = publicKeyOption?.clientDataHash

        var challengeStr = ""
        if (requestJson.isNotBlank()) {
            try {
                val root = JSONObject(requestJson)
                challengeStr = root.optString("challenge")
                if (challengeStr.isBlank() && root.has("publicKey")) {
                    challengeStr = root.getJSONObject("publicKey").optString("challenge")
                }
            } catch (_: Exception) {}
        }
        if (challengeStr.isBlank()) {
            challengeStr = encodeBase64Url(ByteArray(32))
        }

        val callingAppInfo = getRequest?.callingAppInfo
        val origin = callingAppInfo?.origin ?: "https://$rpId"

        // Build clientDataJSON
        val clientDataJsonObj = JSONObject().apply {
            put("type", "webauthn.get")
            put("challenge", challengeStr)
            put("origin", origin)
            if (callingPkg.isNotBlank()) {
                put("androidPackageName", callingPkg)
            }
        }
        val clientDataJsonBytes = clientDataJsonObj.toString().toByteArray(Charsets.UTF_8)
        val clientDataJsonB64Url = encodeBase64Url(clientDataJsonBytes)

        val clientDataHash = clientDataHashFromOption
            ?: MessageDigest.getInstance("SHA-256").digest(clientDataJsonBytes)

        // 4. Build Authenticator Data (37 bytes)
        // 32 bytes rpIdHash + 1 byte flags (UP=0x01, UV=0x04, BE=0x08, BS=0x10) + 4 bytes signCount
        val rpIdHash = MessageDigest.getInstance("SHA-256").digest(rpId.toByteArray(Charsets.UTF_8))
        val flags = (0x01 or 0x04 or 0x08 or 0x10).toByte()
        val nextSignCount = item.passkeySignCount + 1
        val signCountBytes = ByteBuffer.allocate(4).putInt(nextSignCount.toInt()).array()

        val authData = ByteArray(37)
        System.arraycopy(rpIdHash, 0, authData, 0, 32)
        authData[32] = flags
        System.arraycopy(signCountBytes, 0, authData, 33, 4)

        // 5. Sign: authData || clientDataHash using ECDSA P-256
        val toBeSigned = ByteArray(authData.size + clientDataHash.size)
        System.arraycopy(authData, 0, toBeSigned, 0, authData.size)
        System.arraycopy(clientDataHash, 0, toBeSigned, authData.size, clientDataHash.size)

        val privateKeyBytes = decodePrivateKey(item.passkeyPrivateKey!!)
        val keyFactory = KeyFactory.getInstance("EC")
        val privateKey = keyFactory.generatePrivate(PKCS8EncodedKeySpec(privateKeyBytes))

        val signer = Signature.getInstance("SHA256withECDSA")
        signer.initSign(privateKey)
        signer.update(toBeSigned)
        val derSignature = signer.sign()

        val authDataB64Url = encodeBase64Url(authData)
        val sigB64Url = encodeBase64Url(derSignature)
        val rawCredIdB64Url = item.passkeyCredentialId ?: credentialId

        // 6. Build W3C FIDO2 assertion response JSON
        val responseObj = JSONObject().apply {
            put("id", rawCredIdB64Url)
            put("rawId", rawCredIdB64Url)
            put("type", "public-key")
            put("authenticatorAttachment", "platform")

            val responseInner = JSONObject().apply {
                put("clientDataJSON", clientDataJsonB64Url)
                put("authenticatorData", authDataB64Url)
                put("signature", sigB64Url)
                if (!item.passkeyUserHandle.isNullOrBlank()) {
                    put("userHandle", item.passkeyUserHandle)
                }
            }
            put("response", responseInner)
            put("clientExtensionResults", JSONObject())
        }

        val responseJson = responseObj.toString()
        Log.d(TAG, "Successfully generated passkey assertion for ${item.username} on $rpId")

        // 7. Update signCount in store
        AutofillCredentialStore.updatePasskeySignCount(
            item.passkeyCredentialId ?: item.id,
            nextSignCount,
            applicationContext
        )

        // 8. Deliver GetCredentialResponse to Android OS
        val publicKeyCredential = PublicKeyCredential(responseJson)
        val getCredentialResponse = GetCredentialResponse(publicKeyCredential)
        PendingIntentHandler.setGetCredentialResponse(resultIntent, getCredentialResponse)

        setResult(Activity.RESULT_OK, resultIntent)
        finish()
    }

    private fun handlePasswordAuth() {
        val resultIntent = Intent()
        val username = intent.getStringExtra(VaultrCredentialProviderService.EXTRA_USERNAME) ?: ""
        val password = intent.getStringExtra(VaultrCredentialProviderService.EXTRA_PASSWORD) ?: ""

        if (username.isBlank() && password.isBlank()) {
            finishWithFailure("Password credential was empty")
            return
        }

        val passwordCredential = PasswordCredential(username, password)
        val getCredentialResponse = GetCredentialResponse(passwordCredential)
        PendingIntentHandler.setGetCredentialResponse(resultIntent, getCredentialResponse)

        Log.d(TAG, "Successfully returned password credential for $username")
        setResult(Activity.RESULT_OK, resultIntent)
        finish()
    }

    private fun finishWithFailure(message: String) {
        val resultIntent = Intent()
        PendingIntentHandler.setGetCredentialException(
            resultIntent,
            GetCredentialUnknownException(message)
        )
        setResult(Activity.RESULT_CANCELED, resultIntent)
        finish()
    }
}
