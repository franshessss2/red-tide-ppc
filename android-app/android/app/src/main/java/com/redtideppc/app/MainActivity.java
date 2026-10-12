package com.redtideppc.app;

import android.os.Bundle;
import android.graphics.Color;
import android.view.View;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        reserveSystemBarSpace();
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge() == null ? null : getBridge().getWebView();
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                } else {
                    // At the root, let Android return to the launcher normally.
                    setEnabled(false);
                    try {
                        getOnBackPressedDispatcher().onBackPressed();
                    } finally {
                        setEnabled(true);
                    }
                }
            }
        });
    }

    private void reserveSystemBarSpace() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        View decor = getWindow().getDecorView();
        decor.setBackgroundColor(Color.rgb(12, 10, 9));
        ViewCompat.setOnApplyWindowInsetsListener(decor, (view, insets) -> {
            int safeTypes = WindowInsetsCompat.Type.systemBars()
                | WindowInsetsCompat.Type.displayCutout();
            Insets bars = insets.getInsets(safeTypes);
            int bottom = bars.bottom;
            if (insets.isVisible(WindowInsetsCompat.Type.ime())) {
                bottom = Math.max(bottom, insets.getInsets(WindowInsetsCompat.Type.ime()).bottom);
            }
            // Absolute padding is recalculated on rotation, bar and keyboard changes.
            // The entire WebView stays in the safe viewport, including fixed UI/dialogs.
            view.setPadding(bars.left, bars.top, bars.right, bottom);
            // The bars are already reserved natively; do not apply them again in CSS.
            // Keep other insets (including IME) available rather than consuming all.
            return new WindowInsetsCompat.Builder(insets)
                .setInsets(safeTypes, Insets.NONE)
                .build();
        });
        ViewCompat.requestApplyInsets(decor);
    }
}
