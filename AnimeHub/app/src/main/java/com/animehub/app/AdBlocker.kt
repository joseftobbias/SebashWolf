package com.animehub.app

import android.net.Uri
import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream

object AdBlocker {

    private val AD_HOSTS = setOf(
        "doubleclick.net",
        "googlesyndication.com",
        "googleadservices.com",
        "adsterra.com",
        "popads.net",
        "popcash.net",
        "propellerads.com",
        "exoclick.com",
        "juicyads.com",
        "monetag.com",
        "adnxs.com",
        "adform.net",
        "betweendns.com",
        "onclickads.net",
        "syndicatedads.net",
        "adsystem.com",
        "taboola.com",
        "outbrain.com",
        "criteo.com",
        "amazon-adsystem.com",
        "media.net",
        "a-ads.com",
        "hilltopads.com",
        "clickadu.com",
        "adbrau.com",
        "adtrue.com",
        "realsrv.com",
        "exosrv.com",
        "trafficjunky.net",
        "ero-advertising.com"
    )

    private val AD_KEYWORDS = listOf(
        "adservice",
        "adserver",
        "adsystem",
        "popunder",
        "popover",
        "adsterra",
        "monetag",
        "propellerads",
        "exoclick",
        "doubleclick",
        "googlesyndication",
        "googleadservices"
    )

    fun isAd(url: Uri): Boolean {
        val host = url.host?.lowercase() ?: return false
        val urlString = url.toString().lowercase()

        // Don't block allowed app hosts
        if (AppConfig.ALLOWED_HOSTS.any { host == it || host.endsWith(".$it") }) {
            return false
        }

        // Check host matches known ad hosts
        if (AD_HOSTS.any { host == it || host.endsWith(".$it") }) {
            return true
        }

        // Check URL string for ad keywords
        if (AD_KEYWORDS.any { urlString.contains(it) }) {
            return true
        }

        return false
    }

    fun createEmptyResource(): WebResourceResponse {
        return WebResourceResponse(
            "text/plain",
            "UTF-8",
            ByteArrayInputStream(ByteArray(0))
        )
    }

    fun getAdBlockScript(): String {
        return """
            (function() {
                // Override window.open to prevent popup ads
                window.open = function() { return null; };
                
                // Function to remove known ad elements
                function removeAds() {
                    var selectors = [
                        'iframe[src*="ad"]',
                        'iframe[src*="banner"]',
                        'div[class*="ad-"]',
                        'div[id*="ad-"]',
                        'div[class*="popunder"]',
                        'div[id*="popunder"]',
                        '.ad-box',
                        '.ad-container',
                        '.banner-ad',
                        '#popunder',
                        '#pop'
                    ];
                    selectors.forEach(function(selector) {
                        var elements = document.querySelectorAll(selector);
                        elements.forEach(function(el) {
                            el.remove();
                        });
                    });
                }
                
                // Run on load and periodically
                removeAds();
                setInterval(removeAds, 2000);
            })();
        """.trimIndent()
    }
}
