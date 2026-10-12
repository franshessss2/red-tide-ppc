package com.redtideppc.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import android.app.Instrumentation;
import android.content.Intent;
import android.os.SystemClock;
import android.view.View;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Device regressions for native viewport protection; no shipped test hooks. */
@RunWith(AndroidJUnit4.class)
public class SafeViewportTest {
    private static final int SAFE_TYPES = WindowInsetsCompat.Type.systemBars()
        | WindowInsetsCompat.Type.displayCutout();

    private static MainActivity launch(Instrumentation instrumentation) {
        Intent intent = new Intent(instrumentation.getTargetContext(), MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        return (MainActivity) instrumentation.startActivitySync(intent);
    }

    @Test
    public void webViewFitsInsideActualSystemBarsAndCutout() {
        Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        MainActivity activity = launch(instrumentation);
        try {
            AtomicBoolean ready = new AtomicBoolean(false);
            long deadline = SystemClock.uptimeMillis() + 15000;
            do {
                instrumentation.runOnMainSync(() -> {
                    View decor = activity.getWindow().getDecorView();
                    WebView webView = activity.getBridge().getWebView();
                    WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(decor);
                    if (insets == null || webView.getHeight() == 0) return;
                    Insets bars = insets.getInsets(SAFE_TYPES);
                    if (decor.getPaddingTop() != bars.top) return;
                    int[] origin = new int[2];
                    int[] webOrigin = new int[2];
                    decor.getLocationOnScreen(origin);
                    webView.getLocationOnScreen(webOrigin);
                    assertTrue("Header viewport overlaps the status bar/cutout",
                        webOrigin[1] >= origin[1] + bars.top);
                    assertTrue("Viewport overlaps the left cutout", webOrigin[0] >= origin[0] + bars.left);
                    assertTrue("Viewport overlaps the right cutout",
                        webOrigin[0] + webView.getWidth() <= origin[0] + decor.getWidth() - bars.right);
                    assertTrue("Viewport overlaps the navigation bar",
                        webOrigin[1] + webView.getHeight() <= origin[1] + decor.getHeight() - bars.bottom);
                    ready.set(true);
                });
                if (ready.get()) break;
                SystemClock.sleep(100);
            } while (SystemClock.uptimeMillis() < deadline);
            assertTrue("Safe WebView bounds did not settle", ready.get());
        } finally {
            instrumentation.runOnMainSync(activity::finish);
        }
    }

    @Test
    public void insetChangesDoNotAccumulateOrReachCssTwice() {
        Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        MainActivity activity = launch(instrumentation);
        try {
            instrumentation.runOnMainSync(() -> {
                View decor = activity.getWindow().getDecorView();
                Insets portrait = Insets.of(0, 48, 0, 24);
                checkInsets(decor, portrait, Insets.NONE, Insets.NONE, portrait);
                checkInsets(decor, portrait, Insets.NONE, Insets.NONE, portrait);
                checkInsets(decor, Insets.of(0, 0, 16, 24), Insets.of(64, 0, 0, 0),
                    Insets.NONE, Insets.of(64, 0, 16, 24));
                checkInsets(decor, portrait, Insets.NONE, Insets.of(0, 0, 0, 320),
                    Insets.of(0, 48, 0, 320));
                checkInsets(decor, portrait, Insets.NONE, Insets.of(0, 0, 0, 8), portrait);
                checkInsets(decor, Insets.NONE, Insets.NONE, Insets.NONE, Insets.NONE);
            });
        } finally {
            instrumentation.runOnMainSync(activity::finish);
        }
    }

    private static void checkInsets(View decor, Insets bars, Insets cutout, Insets ime, Insets expected) {
        WindowInsetsCompat input = new WindowInsetsCompat.Builder()
            .setInsets(WindowInsetsCompat.Type.systemBars(), bars)
            .setInsets(WindowInsetsCompat.Type.displayCutout(), cutout)
            .setVisible(SAFE_TYPES, true)
            .setInsets(WindowInsetsCompat.Type.ime(), ime)
            .setVisible(WindowInsetsCompat.Type.ime(), ime.bottom > 0)
            .build();
        WindowInsetsCompat remaining = ViewCompat.dispatchApplyWindowInsets(decor, input);
        assertEquals(expected.left, decor.getPaddingLeft());
        assertEquals(expected.top, decor.getPaddingTop());
        assertEquals(expected.right, decor.getPaddingRight());
        assertEquals(expected.bottom, decor.getPaddingBottom());
        assertEquals(Insets.NONE, remaining.getInsets(SAFE_TYPES));
        assertEquals(ime, remaining.getInsets(WindowInsetsCompat.Type.ime()));
    }
}
