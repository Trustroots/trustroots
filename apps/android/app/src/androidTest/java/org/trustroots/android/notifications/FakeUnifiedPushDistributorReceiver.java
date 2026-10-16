package org.trustroots.android.notifications;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

/** Receives connector broadcasts in the separate test APK without target-app dependencies. */
public final class FakeUnifiedPushDistributorReceiver extends BroadcastReceiver {
    public static final String RESULT_ACTION =
            "org.trustroots.android.debug.test.UNIFIED_PUSH_FIXTURE_RESULT";
    private static final String PREFERENCES = "unified-push-test-distributor";
    private static final String TARGET_PACKAGE = "target-package";

    @Override
    public void onReceive(Context context, Intent intent) {
        // UNREGISTER carries a token but no application package in connector 3.3.5.
        SharedPreferences preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
        String targetPackage = intent.getStringExtra("application");
        if (targetPackage == null) targetPackage = preferences.getString(TARGET_PACKAGE, null);
        if (targetPackage == null) return;
        if (intent.hasExtra("application")) {
            preferences.edit().putString(TARGET_PACKAGE, targetPackage).commit();
        }
        Intent result = new Intent(RESULT_ACTION)
                .setPackage(targetPackage)
                .putExtra("action", intent.getAction())
                .putExtra("targetPackage", targetPackage)
                .putExtra("token", intent.getStringExtra("token"))
                .putExtra("message", intent.getStringExtra("message"))
                .putExtra("vapid", intent.getStringExtra("vapid"))
                .putExtra("application", intent.getStringExtra("application"))
                .putExtra("features", intent.getStringArrayExtra("features"));
        context.sendBroadcast(result);
    }
}
