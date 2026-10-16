package org.trustroots.android.notifications;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

/** Starts the test APK so Android will deliver later broadcasts to its fake distributor. */
public final class FakeUnifiedPushDistributorLaunchActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        String targetPackage = getIntent().getStringExtra("application");
        if (targetPackage != null) {
            Intent launched = new Intent(FakeUnifiedPushDistributorReceiver.RESULT_ACTION)
                    .setPackage(targetPackage)
                    .putExtra("action", "fixture-launched")
                    .putExtra("application", targetPackage)
                    .putExtra("targetPackage", targetPackage);
            sendBroadcast(launched);
        }
        finish();
    }
}
