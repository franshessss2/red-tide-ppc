package com.redtideppc.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import android.app.Instrumentation;
import android.content.Intent;
import android.os.SystemClock;
import android.view.KeyEvent;
import android.webkit.WebView;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Exercises the real packaged WebView and Android Back dispatcher on a device. */
@RunWith(AndroidJUnit4.class)
public class BackNavigationTest {
    private interface Condition { boolean check(); }

    private static void awaitOnMain(Instrumentation instrumentation, Condition condition) {
        long deadline = SystemClock.uptimeMillis() + 15000;
        AtomicBoolean ready = new AtomicBoolean(false);
        do {
            instrumentation.runOnMainSync(() -> ready.set(condition.check()));
            if (ready.get()) return;
            SystemClock.sleep(100);
        } while (SystemClock.uptimeMillis() < deadline);
        assertTrue("Timed out waiting for the packaged WebView or Activity", ready.get());
    }

    @Test
    public void backReturnsThroughWebHistoryThenExitsAtRoot() throws Exception {
        Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        assertEquals("com.redtideppc.app", instrumentation.getTargetContext().getPackageName());
        Intent intent = new Intent(instrumentation.getTargetContext(), MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        MainActivity activity = (MainActivity) instrumentation.startActivitySync(intent);
        try {
            awaitOnMain(instrumentation, () -> activity.getBridge() != null
                && activity.getBridge().getWebView().getProgress() == 100);
            WebView webView = activity.getBridge().getWebView();
            CountDownLatch navigation = new CountDownLatch(1);
            instrumentation.runOnMainSync(() -> webView.evaluateJavascript(
                "history.pushState({}, '', '/map'); window.dispatchEvent(new PopStateEvent('popstate'))",
                ignored -> navigation.countDown()));
            assertTrue("SPA navigation did not finish", navigation.await(15, TimeUnit.SECONDS));
            awaitOnMain(instrumentation, () -> webView.canGoBack()
                && webView.getUrl().endsWith("/map"));
            instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_BACK);
            awaitOnMain(instrumentation, () -> !webView.canGoBack()
                && webView.getUrl().equals("https://localhost/"));
            instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_BACK);
            awaitOnMain(instrumentation, () -> activity.isFinishing() || activity.isDestroyed());
        } finally {
            instrumentation.runOnMainSync(() -> {
                if (!activity.isFinishing()) activity.finish();
            });
        }
    }
}
