package com.canchasamigos

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.common.assets.ReactFontManager
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // Fuente Inter (res/font/inter.xml): con fontFamily "Inter" cada fontWeight usa su archivo
    ReactFontManager.getInstance().addCustomFont(this, "Inter", R.font.inter)
    loadReactNative(this)
    crearCanalDeAvisos()
  }

  // Canal de las notificaciones push (Android 8 o superior): con sonido y aviso emergente.
  // La API manda cada notificación a este canal ("avisos", ver backend/src/Services/Fcm.php).
  private fun crearCanalDeAvisos() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val canal = NotificationChannel("avisos", "Avisos del complejo", NotificationManager.IMPORTANCE_HIGH)
    canal.description = "Turnos nuevos o cancelados, pagos recibidos, recordatorios y resumen de caja"
    getSystemService(NotificationManager::class.java).createNotificationChannel(canal)
  }
}
