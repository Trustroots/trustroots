package org.trustroots.android.ui.icons

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathFillType.Companion.NonZero
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap.Companion.Butt
import androidx.compose.ui.graphics.StrokeJoin.Companion.Miter
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.ImageVector.Builder
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.unit.dp
import kotlin.Unit


public val TrustrootsLogo: ImageVector
    get() {
        if (_trustrootsLogo != null) {
            return _trustrootsLogo!!
        }
        _trustrootsLogo = Builder(name = "Trustroots Logo", defaultWidth = 609.3.dp, defaultHeight =
                628.6.dp, viewportWidth = 609.3f, viewportHeight = 628.6f).apply {
            path(fill = SolidColor(Color(0xFF000000)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(18.2f, 517.5f)
                lineTo(0.0f, 517.5f)
                verticalLineToRelative(-14.9f)
                horizontalLineToRelative(52.4f)
                verticalLineToRelative(14.9f)
                lineTo(34.1f, 517.5f)
                verticalLineToRelative(95.5f)
                lineTo(18.2f, 613.0f)
                lineTo(18.2f, 517.5f)
                close()
            }
            path(fill = SolidColor(Color(0xFF000000)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(59.3f, 502.6f)
                horizontalLineToRelative(25.5f)
                curveToRelative(18.6f, 0.0f, 27.8f, 10.9f, 27.8f, 32.5f)
                curveToRelative(0.0f, 6.3f, -1.0f, 11.9f, -3.0f, 16.6f)
                curveToRelative(-2.0f, 4.6f, -5.6f, 8.3f, -10.6f, 10.9f)
                lineToRelative(16.9f, 50.4f)
                horizontalLineToRelative(-16.9f)
                lineTo(84.5f, 565.9f)
                horizontalLineToRelative(-9.3f)
                verticalLineToRelative(47.1f)
                lineTo(59.3f, 613.0f)
                lineTo(59.3f, 502.6f)
                close()
                moveTo(75.3f, 552.0f)
                horizontalLineToRelative(9.0f)
                curveToRelative(2.7f, 0.0f, 5.0f, -0.3f, 6.6f, -1.3f)
                curveToRelative(1.7f, -0.7f, 3.0f, -2.0f, 3.6f, -3.3f)
                curveToRelative(1.0f, -1.3f, 1.3f, -3.3f, 1.7f, -5.3f)
                reflectiveCurveToRelative(0.3f, -4.6f, 0.3f, -7.3f)
                reflectiveCurveToRelative(0.0f, -5.3f, -0.3f, -7.3f)
                curveToRelative(-0.3f, -2.0f, -1.0f, -4.0f, -2.0f, -5.3f)
                curveToRelative(-1.0f, -1.7f, -2.3f, -2.7f, -4.0f, -3.3f)
                curveToRelative(-1.7f, -0.7f, -4.0f, -1.0f, -7.0f, -1.0f)
                horizontalLineToRelative(-8.0f)
                lineTo(75.2f, 552.0f)
                close()
            }
            path(fill = SolidColor(Color(0xFF000000)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(242.7f, 534.4f)
                horizontalLineToRelative(-15.9f)
                verticalLineToRelative(-3.6f)
                curveToRelative(0.0f, -3.6f, -1.0f, -6.6f, -2.7f, -9.3f)
                reflectiveCurveToRelative(-4.6f, -4.0f, -8.6f, -4.0f)
                curveToRelative(-2.3f, 0.0f, -4.0f, 0.3f, -5.3f, 1.3f)
                curveToRelative(-1.3f, 1.0f, -2.3f, 2.0f, -3.3f, 3.3f)
                curveToRelative(-0.7f, 1.3f, -1.3f, 2.7f, -1.7f, 4.6f)
                curveToRelative(-0.3f, 1.7f, -0.3f, 3.6f, -0.3f, 5.3f)
                curveToRelative(0.0f, 2.3f, 0.0f, 4.0f, 0.3f, 5.6f)
                curveToRelative(0.3f, 1.7f, 0.7f, 2.7f, 1.3f, 4.0f)
                curveToRelative(0.7f, 1.0f, 1.7f, 2.0f, 2.7f, 3.0f)
                curveToRelative(1.3f, 1.0f, 2.7f, 1.7f, 5.0f, 2.3f)
                lineToRelative(12.3f, 5.0f)
                curveToRelative(3.6f, 1.3f, 6.3f, 3.0f, 8.6f, 4.6f)
                curveToRelative(2.3f, 1.7f, 4.0f, 4.0f, 5.0f, 6.3f)
                curveToRelative(1.3f, 2.3f, 2.0f, 5.3f, 2.3f, 8.3f)
                curveToRelative(0.3f, 3.3f, 0.7f, 6.6f, 0.7f, 10.9f)
                curveToRelative(0.0f, 4.6f, -0.3f, 9.0f, -1.3f, 12.9f)
                curveToRelative(-1.0f, 4.0f, -2.3f, 7.3f, -4.6f, 10.3f)
                curveToRelative(-2.0f, 3.0f, -5.0f, 5.0f, -8.6f, 6.6f)
                curveToRelative(-3.6f, 1.7f, -8.0f, 2.3f, -12.9f, 2.3f)
                curveToRelative(-4.0f, 0.0f, -7.3f, -0.7f, -10.6f, -2.0f)
                curveToRelative(-3.3f, -1.3f, -6.3f, -3.3f, -8.6f, -5.6f)
                curveToRelative(-2.3f, -2.3f, -4.3f, -5.0f, -5.6f, -8.3f)
                curveToRelative(-1.3f, -3.3f, -2.0f, -6.6f, -2.0f, -10.3f)
                verticalLineToRelative(-6.0f)
                horizontalLineToRelative(15.9f)
                verticalLineToRelative(5.0f)
                curveToRelative(0.0f, 3.0f, 1.0f, 5.6f, 2.7f, 8.0f)
                reflectiveCurveToRelative(4.6f, 3.6f, 8.6f, 3.6f)
                curveToRelative(2.7f, 0.0f, 4.6f, -0.3f, 6.3f, -1.3f)
                curveToRelative(1.7f, -0.7f, 2.7f, -2.0f, 3.3f, -3.3f)
                curveToRelative(0.7f, -1.3f, 1.3f, -3.0f, 1.3f, -5.3f)
                curveToRelative(0.3f, -2.0f, 0.3f, -4.3f, 0.3f, -7.0f)
                curveToRelative(0.0f, -3.0f, 0.0f, -5.3f, -0.3f, -7.3f)
                curveToRelative(-0.3f, -2.0f, -0.7f, -3.3f, -1.3f, -4.6f)
                curveToRelative(-0.7f, -1.0f, -1.7f, -2.0f, -2.7f, -2.7f)
                curveToRelative(-1.3f, -0.7f, -2.7f, -1.7f, -4.6f, -2.3f)
                lineToRelative(-11.3f, -4.6f)
                curveToRelative(-7.0f, -2.7f, -11.3f, -6.6f, -13.6f, -10.9f)
                curveToRelative(-2.3f, -4.6f, -3.6f, -10.3f, -3.6f, -17.2f)
                curveToRelative(0.0f, -4.0f, 0.7f, -8.0f, 1.7f, -11.9f)
                curveToRelative(1.0f, -3.6f, 2.7f, -7.0f, 5.0f, -9.6f)
                curveToRelative(2.3f, -2.7f, 5.0f, -5.0f, 8.6f, -6.3f)
                curveToRelative(3.3f, -1.7f, 7.3f, -2.3f, 11.9f, -2.3f)
                curveToRelative(4.0f, 0.0f, 7.6f, 0.7f, 10.9f, 2.3f)
                curveToRelative(3.3f, 1.3f, 6.0f, 3.3f, 8.3f, 5.6f)
                curveToRelative(2.3f, 2.3f, 4.0f, 5.0f, 5.3f, 8.0f)
                reflectiveCurveToRelative(2.0f, 6.0f, 2.0f, 9.0f)
                verticalLineToRelative(7.6f)
                lineTo(242.7f, 534.4f)
                close()
            }
            path(fill = SolidColor(Color(0xFF000000)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(264.9f, 517.5f)
                horizontalLineToRelative(-18.2f)
                verticalLineToRelative(-14.9f)
                lineTo(299.0f, 502.6f)
                verticalLineToRelative(14.9f)
                horizontalLineToRelative(-18.2f)
                verticalLineToRelative(95.5f)
                horizontalLineToRelative(-15.9f)
                lineTo(264.9f, 517.5f)
                close()
            }
            path(fill = SolidColor(Color(0xFF000000)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(306.0f, 502.6f)
                horizontalLineToRelative(25.5f)
                curveToRelative(18.6f, 0.0f, 27.8f, 10.9f, 27.8f, 32.5f)
                curveToRelative(0.0f, 6.3f, -1.0f, 11.9f, -3.0f, 16.6f)
                curveToRelative(-2.0f, 4.6f, -5.6f, 8.3f, -10.6f, 10.9f)
                lineToRelative(16.9f, 50.4f)
                horizontalLineToRelative(-16.9f)
                lineTo(331.2f, 565.9f)
                horizontalLineToRelative(-9.6f)
                verticalLineToRelative(47.1f)
                horizontalLineToRelative(-15.9f)
                lineTo(305.7f, 502.6f)
                lineTo(306.0f, 502.6f)
                close()
                moveTo(321.9f, 552.0f)
                horizontalLineToRelative(9.0f)
                curveToRelative(2.7f, 0.0f, 5.0f, -0.3f, 6.6f, -1.3f)
                curveToRelative(1.7f, -0.7f, 3.0f, -2.0f, 3.6f, -3.3f)
                curveToRelative(1.0f, -1.3f, 1.3f, -3.3f, 1.7f, -5.3f)
                reflectiveCurveToRelative(0.3f, -4.6f, 0.3f, -7.3f)
                reflectiveCurveToRelative(0.0f, -5.3f, -0.3f, -7.3f)
                curveToRelative(-0.3f, -2.0f, -1.0f, -4.0f, -2.0f, -5.3f)
                curveToRelative(-1.0f, -1.7f, -2.3f, -2.7f, -4.0f, -3.3f)
                curveToRelative(-1.7f, -0.7f, -4.0f, -1.0f, -7.0f, -1.0f)
                horizontalLineToRelative(-8.3f)
                verticalLineToRelative(34.1f)
                lineTo(321.9f, 552.0f)
                close()
            }
            path(fill = SolidColor(Color(0xFF000000)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(371.3f, 528.8f)
                curveToRelative(0.0f, -4.3f, 0.7f, -8.3f, 2.3f, -11.9f)
                curveToRelative(1.7f, -3.3f, 3.6f, -6.3f, 6.0f, -8.6f)
                curveToRelative(2.7f, -2.3f, 5.3f, -4.0f, 8.6f, -5.0f)
                curveToRelative(3.3f, -1.0f, 6.3f, -1.7f, 9.6f, -1.7f)
                reflectiveCurveToRelative(6.3f, 0.7f, 9.6f, 1.7f)
                reflectiveCurveToRelative(6.0f, 3.0f, 8.6f, 5.0f)
                curveToRelative(2.7f, 2.3f, 4.6f, 5.0f, 6.0f, 8.6f)
                curveToRelative(1.7f, 3.3f, 2.3f, 7.3f, 2.3f, 11.9f)
                verticalLineToRelative(58.3f)
                curveToRelative(0.0f, 4.6f, -0.7f, 8.6f, -2.3f, 11.9f)
                curveToRelative(-1.7f, 3.3f, -3.6f, 6.3f, -6.0f, 8.3f)
                curveToRelative(-2.7f, 2.3f, -5.3f, 4.0f, -8.6f, 5.0f)
                curveToRelative(-3.3f, 1.0f, -6.3f, 1.7f, -9.6f, 1.7f)
                reflectiveCurveToRelative(-6.3f, -0.7f, -9.6f, -1.7f)
                curveToRelative(-3.3f, -1.0f, -6.0f, -2.7f, -8.6f, -5.0f)
                curveToRelative(-2.7f, -2.3f, -4.6f, -5.0f, -6.0f, -8.3f)
                curveToRelative(-1.7f, -3.3f, -2.3f, -7.3f, -2.3f, -11.9f)
                lineTo(371.3f, 528.8f)
                close()
                moveTo(386.9f, 587.1f)
                curveToRelative(0.0f, 4.0f, 1.0f, 6.6f, 3.3f, 8.6f)
                reflectiveCurveToRelative(4.6f, 2.7f, 7.6f, 2.7f)
                reflectiveCurveToRelative(5.3f, -1.0f, 7.6f, -2.7f)
                curveToRelative(2.0f, -1.7f, 3.3f, -4.6f, 3.3f, -8.6f)
                verticalLineToRelative(-58.3f)
                curveToRelative(0.0f, -4.0f, -1.0f, -6.6f, -3.3f, -8.6f)
                curveToRelative(-2.0f, -1.7f, -4.6f, -2.7f, -7.6f, -2.7f)
                reflectiveCurveToRelative(-5.3f, 1.0f, -7.6f, 2.7f)
                curveToRelative(-2.3f, 1.7f, -3.3f, 4.6f, -3.3f, 8.6f)
                lineTo(386.9f, 587.1f)
                close()
            }
            path(fill = SolidColor(Color(0xFF000000)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(437.3f, 528.8f)
                curveToRelative(0.0f, -4.3f, 0.7f, -8.3f, 2.3f, -11.9f)
                curveToRelative(1.7f, -3.3f, 3.6f, -6.3f, 6.0f, -8.6f)
                curveToRelative(2.7f, -2.3f, 5.3f, -4.0f, 8.6f, -5.0f)
                reflectiveCurveToRelative(6.3f, -1.7f, 9.6f, -1.7f)
                reflectiveCurveToRelative(6.3f, 0.7f, 9.6f, 1.7f)
                reflectiveCurveToRelative(6.0f, 3.0f, 8.6f, 5.0f)
                curveToRelative(2.7f, 2.3f, 4.6f, 5.0f, 6.0f, 8.6f)
                curveToRelative(1.7f, 3.3f, 2.3f, 7.3f, 2.3f, 11.9f)
                verticalLineToRelative(58.3f)
                curveToRelative(0.0f, 4.6f, -0.7f, 8.6f, -2.3f, 11.9f)
                curveToRelative(-1.7f, 3.3f, -3.6f, 6.3f, -6.0f, 8.3f)
                curveToRelative(-2.7f, 2.3f, -5.3f, 4.0f, -8.6f, 5.0f)
                curveToRelative(-3.3f, 1.0f, -6.3f, 1.7f, -9.6f, 1.7f)
                reflectiveCurveToRelative(-6.3f, -0.7f, -9.6f, -1.7f)
                curveToRelative(-3.3f, -1.0f, -6.0f, -2.7f, -8.6f, -5.0f)
                reflectiveCurveToRelative(-4.6f, -5.0f, -6.0f, -8.3f)
                curveToRelative(-1.7f, -3.3f, -2.3f, -7.3f, -2.3f, -11.9f)
                lineTo(437.3f, 528.8f)
                close()
                moveTo(453.2f, 587.1f)
                curveToRelative(0.0f, 4.0f, 1.0f, 6.6f, 3.3f, 8.6f)
                reflectiveCurveToRelative(4.6f, 2.7f, 7.6f, 2.7f)
                curveToRelative(3.0f, 0.0f, 5.3f, -1.0f, 7.6f, -2.7f)
                curveToRelative(2.0f, -1.7f, 3.3f, -4.6f, 3.3f, -8.6f)
                verticalLineToRelative(-58.3f)
                curveToRelative(0.0f, -4.0f, -1.0f, -6.6f, -3.3f, -8.6f)
                curveToRelative(-2.0f, -1.7f, -4.6f, -2.7f, -7.6f, -2.7f)
                curveToRelative(-3.0f, 0.0f, -5.3f, 1.0f, -7.6f, 2.7f)
                curveToRelative(-2.3f, 1.7f, -3.3f, 4.6f, -3.3f, 8.6f)
                lineTo(453.2f, 587.1f)
                close()
            }
            path(fill = SolidColor(Color(0xFF000000)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(512.9f, 517.5f)
                horizontalLineToRelative(-18.2f)
                verticalLineToRelative(-14.9f)
                lineTo(547.0f, 502.6f)
                verticalLineToRelative(14.9f)
                horizontalLineToRelative(-18.2f)
                verticalLineToRelative(95.5f)
                horizontalLineToRelative(-15.9f)
                lineTo(512.9f, 517.5f)
                close()
            }
            path(fill = SolidColor(Color(0xFF000000)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(605.0f, 534.4f)
                horizontalLineToRelative(-15.9f)
                verticalLineToRelative(-3.6f)
                curveToRelative(0.0f, -3.6f, -1.0f, -6.6f, -2.7f, -9.3f)
                reflectiveCurveToRelative(-4.6f, -4.0f, -8.6f, -4.0f)
                curveToRelative(-2.3f, 0.0f, -4.0f, 0.3f, -5.3f, 1.3f)
                curveToRelative(-1.3f, 1.0f, -2.3f, 2.0f, -3.3f, 3.3f)
                curveToRelative(-0.7f, 1.3f, -1.3f, 2.7f, -1.7f, 4.6f)
                curveToRelative(-0.3f, 1.7f, -0.3f, 3.6f, -0.3f, 5.3f)
                curveToRelative(0.0f, 2.3f, 0.0f, 4.0f, 0.3f, 5.6f)
                curveToRelative(0.0f, 1.7f, 0.7f, 2.7f, 1.3f, 4.0f)
                curveToRelative(0.7f, 1.0f, 1.7f, 2.0f, 2.7f, 3.0f)
                curveToRelative(1.3f, 1.0f, 2.7f, 1.7f, 5.0f, 2.3f)
                lineToRelative(12.3f, 5.0f)
                curveToRelative(3.6f, 1.3f, 6.3f, 3.0f, 8.6f, 4.6f)
                curveToRelative(2.3f, 1.7f, 4.0f, 4.0f, 5.0f, 6.3f)
                curveToRelative(1.3f, 2.3f, 2.0f, 5.3f, 2.3f, 8.3f)
                curveToRelative(0.3f, 3.3f, 0.7f, 6.6f, 0.7f, 10.9f)
                curveToRelative(0.0f, 4.6f, -0.3f, 9.0f, -1.3f, 12.9f)
                curveToRelative(-1.0f, 4.0f, -2.3f, 7.3f, -4.6f, 10.3f)
                curveToRelative(-2.0f, 3.0f, -5.0f, 5.0f, -8.6f, 6.6f)
                curveToRelative(-3.6f, 1.7f, -8.0f, 2.3f, -12.9f, 2.3f)
                curveToRelative(-4.0f, 0.0f, -7.3f, -0.7f, -10.6f, -2.0f)
                curveToRelative(-3.3f, -1.3f, -6.3f, -3.3f, -8.6f, -5.6f)
                reflectiveCurveToRelative(-4.3f, -5.0f, -5.6f, -8.3f)
                curveToRelative(-1.3f, -3.3f, -2.0f, -6.6f, -2.0f, -10.3f)
                verticalLineToRelative(-6.0f)
                horizontalLineToRelative(15.9f)
                verticalLineToRelative(5.0f)
                curveToRelative(0.0f, 3.0f, 1.0f, 5.6f, 2.7f, 8.0f)
                curveToRelative(1.7f, 2.3f, 4.6f, 3.6f, 8.6f, 3.6f)
                curveToRelative(2.7f, 0.0f, 4.6f, -0.3f, 6.3f, -1.3f)
                curveToRelative(1.7f, -1.0f, 2.7f, -2.0f, 3.3f, -3.3f)
                curveToRelative(0.7f, -1.3f, 1.3f, -3.0f, 1.3f, -5.3f)
                curveToRelative(0.3f, -2.0f, 0.3f, -4.3f, 0.3f, -7.0f)
                curveToRelative(0.0f, -3.0f, 0.0f, -5.3f, -0.3f, -7.3f)
                reflectiveCurveToRelative(-0.7f, -3.3f, -1.3f, -4.6f)
                curveToRelative(-0.7f, -1.0f, -1.7f, -2.0f, -2.7f, -2.7f)
                curveToRelative(-1.3f, -0.7f, -2.7f, -1.7f, -4.6f, -2.3f)
                lineToRelative(-11.3f, -4.6f)
                curveToRelative(-7.0f, -2.7f, -11.3f, -6.6f, -13.6f, -10.9f)
                reflectiveCurveToRelative(-3.6f, -10.3f, -3.6f, -17.2f)
                curveToRelative(0.0f, -4.0f, 0.7f, -8.0f, 1.7f, -11.9f)
                curveToRelative(1.0f, -3.6f, 2.7f, -7.0f, 5.0f, -9.6f)
                curveToRelative(2.3f, -2.7f, 5.0f, -5.0f, 8.6f, -6.3f)
                curveToRelative(3.3f, -1.7f, 7.3f, -2.3f, 11.9f, -2.3f)
                curveToRelative(4.0f, 0.0f, 7.6f, 0.7f, 10.9f, 2.3f)
                curveToRelative(3.3f, 1.3f, 6.0f, 3.3f, 8.3f, 5.6f)
                reflectiveCurveToRelative(4.0f, 5.0f, 5.3f, 8.0f)
                curveToRelative(1.3f, 3.0f, 2.0f, 6.0f, 2.0f, 9.0f)
                verticalLineToRelative(7.6f)
                lineTo(605.0f, 534.4f)
                close()
            }
            path(fill = SolidColor(Color(0xFF000000)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(0.3f, 628.6f)
                lineTo(0.3f, 620.9f)
                horizontalLineToRelative(609.0f)
                verticalLineToRelative(7.6f)
                lineTo(0.3f, 628.5f)
                close()
            }
            path(fill = SolidColor(Color(0xFF251D12)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(331.9f, 418.0f)
                curveToRelative(0.0f, 24.2f, 52.4f, 20.2f, 45.4f, 28.5f)
                curveToRelative(-1.0f, 1.3f, -3.6f, 4.3f, -13.3f, 3.6f)
                curveToRelative(-7.6f, -0.3f, -26.9f, -10.6f, -33.5f, -11.3f)
                curveToRelative(-15.6f, -1.3f, -36.5f, 20.6f, -53.0f, 24.5f)
                curveToRelative(-13.3f, 2.0f, -19.9f, 0.7f, -19.2f, -3.6f)
                curveToRelative(1.0f, -6.3f, 31.8f, -5.3f, 35.5f, -26.9f)
                curveToRelative(-6.6f, 3.6f, -30.8f, 9.9f, -33.5f, 3.3f)
                curveToRelative(-5.6f, -13.6f, 39.5f, 0.7f, 30.8f, -28.8f)
            }
            path(fill = SolidColor(Color(0xFF312716)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(311.3f, 343.8f)
                curveToRelative(13.9f, 0.0f, 28.5f, -7.0f, 27.8f, 15.6f)
                curveToRelative(-1.0f, 24.5f, 2.0f, 46.1f, 2.3f, 57.0f)
                curveToRelative(0.0f, 24.2f, 43.1f, 19.9f, 36.1f, 28.2f)
                curveToRelative(-1.0f, 1.3f, -3.6f, 4.3f, -13.3f, 3.6f)
                curveToRelative(-7.6f, -0.3f, -26.9f, -9.6f, -33.5f, -10.3f)
                curveToRelative(-15.6f, -1.3f, -36.5f, 19.6f, -53.0f, 23.9f)
                curveToRelative(-13.3f, 2.0f, -19.9f, 0.7f, -19.2f, -3.6f)
                curveToRelative(1.0f, -6.3f, 31.8f, -5.3f, 35.5f, -26.9f)
                curveToRelative(-6.6f, 3.6f, -30.8f, 9.9f, -33.5f, 3.3f)
                curveToRelative(-4.3f, -10.6f, 16.9f, -5.6f, 21.2f, -15.9f)
                curveToRelative(3.0f, -7.3f, 0.3f, -29.2f, 0.3f, -64.3f)
                curveTo(281.5f, 344.4f, 287.1f, 343.8f, 311.3f, 343.8f)
                lineTo(311.3f, 343.8f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(171.1f, 300.0f)
                curveToRelative(10.9f, 0.0f, 16.6f, 9.9f, 15.6f, 22.2f)
                curveToRelative(-1.3f, 16.6f, -6.3f, 22.5f, -14.9f, 22.5f)
                curveToRelative(-11.6f, -0.3f, -13.3f, -9.9f, -13.3f, -22.5f)
                curveTo(158.1f, 310.0f, 162.4f, 300.0f, 171.1f, 300.0f)
                lineTo(171.1f, 300.0f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(208.5f, 317.9f)
                curveToRelative(10.9f, 0.0f, 16.6f, 7.6f, 15.9f, 19.9f)
                curveToRelative(-1.3f, 16.6f, -6.3f, 25.2f, -14.9f, 24.9f)
                curveToRelative(-7.0f, 0.0f, -13.3f, -11.3f, -13.3f, -22.5f)
                curveTo(195.9f, 330.5f, 196.9f, 317.9f, 208.5f, 317.9f)
                lineTo(208.5f, 317.9f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(268.2f, 46.4f)
                curveToRelative(11.6f, 0.0f, 17.2f, -10.6f, 15.6f, -23.2f)
                curveToRelative(-2.3f, -16.9f, -8.0f, -23.2f, -16.9f, -23.2f)
                curveToRelative(-12.3f, 0.3f, -13.6f, 10.3f, -13.3f, 23.2f)
                curveTo(253.9f, 36.1f, 259.2f, 46.4f, 268.2f, 46.4f)
                lineTo(268.2f, 46.4f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(199.2f, 75.2f)
                curveToRelative(-11.9f, 0.0f, -17.9f, -10.6f, -16.9f, -23.5f)
                curveToRelative(1.3f, -17.2f, 7.0f, -23.5f, 15.9f, -23.2f)
                curveToRelative(12.6f, 0.3f, 14.3f, 10.3f, 14.6f, 23.2f)
                reflectiveCurveTo(208.5f, 75.2f, 199.2f, 75.2f)
                lineTo(199.2f, 75.2f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(117.4f, 224.8f)
                curveToRelative(-11.9f, 0.0f, -18.6f, -8.3f, -17.2f, -21.9f)
                curveToRelative(1.7f, -17.9f, 7.6f, -27.2f, 16.9f, -27.2f)
                curveToRelative(7.6f, 0.0f, 14.3f, 12.3f, 14.6f, 24.2f)
                curveTo(131.6f, 210.8f, 130.3f, 224.8f, 117.4f, 224.8f)
                lineTo(117.4f, 224.8f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(233.1f, 51.7f)
                curveToRelative(10.3f, 0.0f, 15.3f, -8.3f, 13.9f, -18.6f)
                curveToRelative(-1.7f, -13.6f, -7.0f, -18.6f, -14.9f, -18.6f)
                curveToRelative(-10.9f, 0.3f, -11.9f, 8.6f, -11.9f, 18.6f)
                curveTo(220.5f, 43.4f, 225.1f, 51.7f, 233.1f, 51.7f)
                lineTo(233.1f, 51.7f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(251.0f, 382.2f)
                curveToRelative(10.3f, 0.0f, 15.3f, -7.6f, 13.9f, -20.2f)
                curveToRelative(-2.0f, -16.6f, -7.3f, -25.2f, -15.3f, -24.9f)
                curveToRelative(-6.6f, 0.0f, -11.9f, 11.3f, -11.6f, 22.5f)
                curveTo(238.4f, 369.3f, 239.7f, 382.2f, 251.0f, 382.2f)
                lineTo(251.0f, 382.2f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(139.6f, 284.8f)
                curveToRelative(-8.0f, -0.3f, -12.6f, 4.6f, -11.9f, 12.6f)
                curveToRelative(1.0f, 10.9f, 4.6f, 16.9f, 10.9f, 17.2f)
                curveToRelative(5.3f, 0.0f, 9.9f, -7.0f, 9.9f, -14.6f)
                curveTo(149.2f, 293.7f, 148.5f, 285.1f, 139.6f, 284.8f)
                lineTo(139.6f, 284.8f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(449.2f, 74.2f)
                curveToRelative(10.6f, 0.0f, 16.2f, 9.6f, 15.9f, 20.9f)
                curveToRelative(-0.7f, 15.6f, -5.3f, 21.2f, -13.6f, 21.2f)
                curveToRelative(-11.3f, -0.3f, -12.9f, -9.6f, -13.6f, -21.2f)
                curveTo(436.9f, 83.9f, 440.9f, 74.2f, 449.2f, 74.2f)
                lineTo(449.2f, 74.2f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(303.0f, 2.0f)
                curveToRelative(10.3f, 0.0f, 15.9f, 7.0f, 15.3f, 18.2f)
                curveToRelative(-1.0f, 15.3f, -6.0f, 23.2f, -13.9f, 22.9f)
                curveToRelative(-6.6f, 0.0f, -12.9f, -10.3f, -13.3f, -20.6f)
                curveTo(291.1f, 13.6f, 291.7f, 2.0f, 303.0f, 2.0f)
                lineTo(303.0f, 2.0f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(281.5f, 145.2f)
                curveToRelative(11.9f, 0.0f, 17.2f, -10.9f, 15.6f, -23.9f)
                curveToRelative(-2.3f, -17.6f, -8.0f, -23.9f, -17.2f, -23.9f)
                curveToRelative(-12.3f, 0.3f, -13.6f, 10.6f, -13.3f, 23.9f)
                curveTo(267.2f, 134.6f, 272.2f, 145.2f, 281.5f, 145.2f)
                lineTo(281.5f, 145.2f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(241.7f, 102.4f)
                curveToRelative(10.6f, 0.0f, 16.2f, 7.0f, 15.3f, 18.2f)
                curveToRelative(-1.0f, 15.3f, -6.3f, 22.9f, -14.3f, 22.9f)
                curveToRelative(-6.6f, 0.0f, -12.9f, -10.3f, -13.3f, -20.6f)
                curveTo(229.4f, 114.0f, 230.4f, 102.4f, 241.7f, 102.4f)
                lineTo(241.7f, 102.4f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(479.1f, 153.2f)
                curveToRelative(9.9f, 0.0f, 14.6f, -7.3f, 12.9f, -18.9f)
                curveToRelative(-2.3f, -15.6f, -7.6f, -23.5f, -15.3f, -23.5f)
                curveToRelative(-6.3f, 0.0f, -11.3f, 10.6f, -10.6f, 21.2f)
                curveTo(466.5f, 140.9f, 468.4f, 153.2f, 479.1f, 153.2f)
                lineTo(479.1f, 153.2f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(418.7f, 86.2f)
                curveToRelative(-11.3f, -0.3f, -16.9f, -11.3f, -15.9f, -24.2f)
                curveToRelative(1.3f, -17.2f, 6.6f, -23.2f, 15.3f, -22.9f)
                curveToRelative(11.6f, 0.7f, 13.3f, 10.9f, 13.6f, 23.9f)
                curveTo(432.0f, 76.2f, 427.3f, 86.5f, 418.7f, 86.2f)
                lineTo(418.7f, 86.2f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(461.1f, 182.3f)
                curveToRelative(-9.0f, -0.3f, -13.3f, 5.0f, -12.3f, 13.6f)
                curveToRelative(1.3f, 11.9f, 6.0f, 17.9f, 12.9f, 18.2f)
                curveToRelative(5.6f, 0.0f, 10.3f, -7.6f, 10.3f, -15.6f)
                curveTo(471.8f, 191.9f, 470.4f, 182.7f, 461.1f, 182.3f)
                lineTo(461.1f, 182.3f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(346.8f, 189.6f)
                curveToRelative(-9.0f, -0.3f, -13.3f, 4.3f, -12.6f, 11.9f)
                curveToRelative(1.3f, 10.3f, 5.6f, 15.9f, 12.3f, 15.9f)
                curveToRelative(5.6f, 0.0f, 10.6f, -6.6f, 10.6f, -13.6f)
                curveTo(357.4f, 197.9f, 356.4f, 190.0f, 346.8f, 189.6f)
                lineTo(346.8f, 189.6f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(119.0f, 276.8f)
                curveToRelative(9.9f, 0.3f, 15.3f, -8.6f, 14.6f, -19.6f)
                curveToRelative(-1.0f, -14.9f, -5.6f, -20.6f, -13.3f, -20.9f)
                curveToRelative(-10.6f, -0.3f, -12.3f, 8.6f, -12.6f, 19.6f)
                curveTo(107.4f, 267.2f, 111.4f, 276.5f, 119.0f, 276.8f)
                lineTo(119.0f, 276.8f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(448.6f, 220.1f)
                curveToRelative(11.9f, 0.0f, 18.9f, 8.3f, 18.2f, 21.9f)
                curveToRelative(-0.7f, 18.2f, -6.3f, 27.8f, -15.6f, 27.5f)
                curveToRelative(-7.6f, 0.0f, -15.3f, -12.3f, -15.9f, -24.9f)
                curveTo(434.6f, 234.0f, 435.3f, 220.1f, 448.6f, 220.1f)
                lineTo(448.6f, 220.1f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(492.3f, 205.9f)
                curveToRelative(11.6f, 0.0f, 16.6f, -9.9f, 14.9f, -21.5f)
                curveToRelative(-2.7f, -15.9f, -8.6f, -21.5f, -17.2f, -21.5f)
                curveToRelative(-12.3f, 0.3f, -13.3f, 9.6f, -12.3f, 21.5f)
                curveTo(478.1f, 196.3f, 483.4f, 205.9f, 492.3f, 205.9f)
                lineTo(492.3f, 205.9f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(372.3f, 383.9f)
                curveToRelative(12.3f, -0.7f, 17.6f, -12.3f, 15.3f, -26.2f)
                curveToRelative(-3.3f, -18.6f, -9.6f, -25.2f, -19.2f, -24.5f)
                curveToRelative(-12.9f, 0.7f, -13.6f, 11.9f, -12.6f, 25.9f)
                curveTo(356.7f, 373.0f, 362.7f, 384.2f, 372.3f, 383.9f)
                lineTo(372.3f, 383.9f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(450.9f, 330.5f)
                curveToRelative(12.3f, -0.7f, 17.9f, -9.3f, 15.3f, -23.2f)
                curveToRelative(-3.3f, -18.2f, -10.3f, -27.5f, -19.6f, -27.2f)
                curveToRelative(-7.6f, 0.3f, -13.3f, 12.9f, -12.3f, 25.5f)
                curveTo(435.0f, 316.9f, 437.6f, 331.2f, 450.9f, 330.5f)
                lineTo(450.9f, 330.5f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(479.7f, 269.5f)
                curveToRelative(8.6f, -0.3f, 13.6f, 4.6f, 13.3f, 12.6f)
                curveToRelative(-0.3f, 10.9f, -4.0f, 16.9f, -10.6f, 16.9f)
                curveToRelative(-5.6f, 0.0f, -10.9f, -7.0f, -11.6f, -14.6f)
                curveTo(470.1f, 278.1f, 470.4f, 269.9f, 479.7f, 269.5f)
                lineTo(479.7f, 269.5f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(498.3f, 256.9f)
                curveToRelative(-10.6f, 0.3f, -16.9f, -8.6f, -16.6f, -19.6f)
                curveToRelative(0.0f, -14.9f, 4.6f, -20.6f, 12.9f, -20.6f)
                curveToRelative(11.3f, -0.3f, 13.6f, 8.6f, 14.6f, 19.6f)
                curveTo(510.2f, 247.6f, 506.6f, 256.6f, 498.3f, 256.9f)
                lineTo(498.3f, 256.9f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(417.7f, 357.0f)
                curveToRelative(-12.3f, 0.7f, -18.9f, -6.3f, -18.6f, -17.9f)
                curveToRelative(0.3f, -15.3f, 5.6f, -23.5f, 15.3f, -23.9f)
                curveToRelative(7.6f, -0.3f, 15.3f, 9.9f, 16.2f, 20.2f)
                curveTo(431.0f, 344.8f, 430.6f, 356.7f, 417.7f, 357.0f)
                lineTo(417.7f, 357.0f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(415.7f, 209.5f)
                curveToRelative(9.0f, 0.0f, 13.9f, 7.3f, 13.6f, 19.6f)
                curveToRelative(-0.3f, 16.2f, -4.6f, 24.5f, -11.3f, 24.2f)
                curveToRelative(-5.6f, 0.0f, -11.3f, -10.9f, -11.6f, -21.9f)
                curveTo(405.5f, 222.1f, 406.1f, 209.5f, 415.7f, 209.5f)
                lineTo(415.7f, 209.5f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(376.9f, 24.5f)
                curveToRelative(11.6f, 0.0f, 17.9f, 9.6f, 17.2f, 21.2f)
                curveToRelative(-1.0f, 15.6f, -6.3f, 21.5f, -15.3f, 21.2f)
                curveToRelative(-12.3f, -0.3f, -14.3f, -9.6f, -14.9f, -21.2f)
                curveTo(363.7f, 33.8f, 368.0f, 24.5f, 376.9f, 24.5f)
                lineTo(376.9f, 24.5f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(176.4f, 92.2f)
                curveToRelative(-10.9f, -1.0f, -17.2f, 9.9f, -16.9f, 23.9f)
                curveToRelative(0.3f, 18.6f, 5.0f, 25.9f, 13.6f, 26.5f)
                curveToRelative(11.6f, 0.7f, 13.9f, -10.3f, 14.9f, -24.2f)
                curveTo(188.6f, 104.4f, 184.7f, 92.8f, 176.4f, 92.2f)
                lineTo(176.4f, 92.2f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(134.3f, 82.2f)
                curveToRelative(-10.9f, 0.0f, -16.6f, 8.3f, -15.6f, 21.5f)
                curveToRelative(1.7f, 17.9f, 7.3f, 27.2f, 15.9f, 27.2f)
                curveToRelative(7.0f, 0.0f, 13.3f, -12.3f, 12.9f, -24.5f)
                curveTo(147.5f, 96.1f, 146.2f, 82.2f, 134.3f, 82.2f)
                lineTo(134.3f, 82.2f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(447.6f, 135.9f)
                curveToRelative(10.6f, 0.0f, 16.2f, 9.0f, 15.6f, 20.2f)
                curveToRelative(-0.7f, 14.9f, -5.3f, 20.2f, -13.6f, 20.2f)
                curveToRelative(-11.3f, -0.3f, -12.9f, -9.0f, -13.6f, -20.2f)
                curveTo(435.6f, 144.9f, 439.6f, 135.9f, 447.6f, 135.9f)
                lineTo(447.6f, 135.9f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(159.8f, 47.7f)
                curveToRelative(11.6f, 0.0f, 17.9f, 6.6f, 16.6f, 17.6f)
                curveToRelative(-1.3f, 14.6f, -7.3f, 22.2f, -16.2f, 22.2f)
                curveToRelative(-7.6f, 0.0f, -13.9f, -9.9f, -14.3f, -19.9f)
                curveTo(146.2f, 59.0f, 147.2f, 47.7f, 159.8f, 47.7f)
                lineTo(159.8f, 47.7f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(337.2f, 328.5f)
                curveToRelative(10.9f, 0.0f, 15.9f, -10.3f, 14.3f, -22.9f)
                curveToRelative(-2.3f, -16.9f, -7.6f, -22.9f, -15.9f, -22.9f)
                curveToRelative(-11.3f, 0.3f, -12.6f, 10.3f, -11.9f, 22.9f)
                curveTo(323.9f, 318.3f, 328.9f, 328.5f, 337.2f, 328.5f)
                lineTo(337.2f, 328.5f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(264.9f, 328.5f)
                curveToRelative(10.9f, 0.0f, 16.2f, -8.0f, 14.6f, -20.2f)
                curveToRelative(-2.0f, -16.9f, -7.6f, -25.5f, -15.9f, -25.2f)
                curveToRelative(-7.0f, 0.0f, -12.6f, 11.3f, -12.3f, 22.9f)
                curveTo(251.6f, 315.6f, 253.3f, 328.5f, 264.9f, 328.5f)
                lineTo(264.9f, 328.5f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(302.0f, 335.8f)
                curveToRelative(-9.6f, 0.0f, -14.6f, -9.3f, -13.9f, -20.6f)
                curveToRelative(1.0f, -14.9f, 5.3f, -20.6f, 12.6f, -20.6f)
                curveToRelative(10.3f, 0.3f, 11.6f, 9.3f, 11.9f, 20.6f)
                curveTo(313.3f, 326.5f, 309.6f, 335.8f, 302.0f, 335.8f)
                lineTo(302.0f, 335.8f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(378.6f, 318.9f)
                curveToRelative(-11.9f, 0.0f, -18.6f, -9.0f, -17.9f, -22.9f)
                curveToRelative(1.0f, -18.9f, 6.6f, -28.5f, 15.9f, -28.5f)
                curveToRelative(7.6f, 0.0f, 14.9f, 12.9f, 15.6f, 25.5f)
                curveTo(392.2f, 304.0f, 391.5f, 318.9f, 378.6f, 318.9f)
                lineTo(378.6f, 318.9f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(188.6f, 301.3f)
                curveToRelative(11.3f, 0.0f, 16.6f, -11.6f, 15.3f, -25.5f)
                curveToRelative(-2.0f, -18.6f, -7.3f, -25.5f, -15.9f, -25.2f)
                curveToRelative(-11.6f, 0.3f, -12.9f, 11.3f, -12.9f, 25.2f)
                curveTo(175.4f, 289.7f, 180.0f, 301.3f, 188.6f, 301.3f)
                lineTo(188.6f, 301.3f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(147.2f, 183.0f)
                curveToRelative(10.9f, 0.0f, 16.6f, -7.6f, 15.3f, -19.9f)
                curveToRelative(-1.7f, -16.6f, -7.3f, -24.9f, -15.6f, -24.9f)
                curveToRelative(-7.0f, 0.0f, -12.9f, 11.3f, -12.6f, 22.2f)
                curveTo(133.9f, 170.1f, 135.3f, 183.0f, 147.2f, 183.0f)
                lineTo(147.2f, 183.0f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(350.4f, 70.9f)
                curveToRelative(8.3f, 0.0f, 12.9f, 5.0f, 12.3f, 12.9f)
                curveToRelative(-0.7f, 10.6f, -4.6f, 16.2f, -11.3f, 15.9f)
                curveToRelative(-5.3f, 0.0f, -10.3f, -7.3f, -10.6f, -14.6f)
                curveTo(340.8f, 78.9f, 341.5f, 70.9f, 350.4f, 70.9f)
                lineTo(350.4f, 70.9f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(387.6f, 128.0f)
                curveToRelative(-10.6f, 0.0f, -16.2f, -10.6f, -15.6f, -23.2f)
                curveToRelative(0.7f, -16.9f, 5.6f, -23.2f, 13.6f, -22.9f)
                curveToRelative(10.9f, 0.3f, 12.9f, 10.3f, 13.6f, 22.9f)
                curveTo(399.5f, 117.7f, 395.8f, 128.0f, 387.6f, 128.0f)
                lineTo(387.6f, 128.0f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(243.0f, 94.8f)
                curveToRelative(-11.6f, 0.0f, -17.9f, -6.6f, -16.9f, -17.2f)
                curveToRelative(1.3f, -14.3f, 7.0f, -21.5f, 15.9f, -21.5f)
                curveToRelative(7.3f, 0.0f, 14.3f, 9.6f, 14.3f, 19.2f)
                curveTo(256.9f, 83.9f, 255.6f, 94.8f, 243.0f, 94.8f)
                lineTo(243.0f, 94.8f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(226.8f, 312.6f)
                curveToRelative(10.9f, 0.7f, 16.9f, -8.0f, 15.9f, -22.2f)
                curveToRelative(-1.3f, -18.9f, -6.6f, -28.8f, -15.3f, -28.8f)
                curveToRelative(-7.0f, -0.3f, -13.3f, 11.9f, -13.3f, 24.9f)
                curveTo(213.8f, 297.7f, 215.2f, 312.3f, 226.8f, 312.6f)
                lineTo(226.8f, 312.6f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(342.1f, 57.3f)
                curveToRelative(-10.9f, -0.3f, -16.9f, -9.0f, -15.6f, -21.9f)
                curveToRelative(1.7f, -17.6f, 7.0f, -26.2f, 15.6f, -25.9f)
                curveToRelative(7.0f, 0.3f, 13.3f, 12.6f, 13.3f, 24.2f)
                curveTo(355.4f, 44.4f, 354.1f, 58.0f, 342.1f, 57.3f)
                lineTo(342.1f, 57.3f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(349.8f, 223.4f)
                curveToRelative(-11.9f, 0.0f, -17.6f, 11.3f, -15.9f, 24.5f)
                curveToRelative(2.3f, 18.2f, 8.3f, 24.9f, 17.6f, 24.9f)
                curveToRelative(12.6f, -0.3f, 13.9f, -11.3f, 13.3f, -24.9f)
                curveTo(364.3f, 234.4f, 358.7f, 223.4f, 349.8f, 223.4f)
                lineTo(349.8f, 223.4f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(419.4f, 153.8f)
                curveToRelative(11.9f, 0.0f, 18.6f, 10.9f, 17.9f, 24.2f)
                curveToRelative(-0.7f, 17.9f, -6.3f, 24.5f, -15.6f, 24.2f)
                curveToRelative(-12.6f, -0.3f, -14.9f, -10.9f, -15.6f, -24.2f)
                curveTo(405.8f, 164.8f, 410.4f, 153.8f, 419.4f, 153.8f)
                lineTo(419.4f, 153.8f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(385.2f, 215.5f)
                curveToRelative(-10.6f, 0.0f, -15.6f, 9.0f, -13.9f, 20.2f)
                curveToRelative(2.0f, 14.9f, 7.6f, 20.2f, 15.6f, 20.2f)
                curveToRelative(11.3f, -0.3f, 12.3f, -9.0f, 11.6f, -20.2f)
                curveTo(398.5f, 224.4f, 393.5f, 215.5f, 385.2f, 215.5f)
                lineTo(385.2f, 215.5f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(314.0f, 275.8f)
                curveToRelative(-10.9f, 0.0f, -16.6f, -6.3f, -15.9f, -16.6f)
                curveToRelative(1.0f, -13.6f, 6.3f, -20.9f, 14.6f, -20.6f)
                curveToRelative(7.0f, 0.0f, 13.3f, 9.3f, 13.6f, 18.6f)
                curveTo(326.5f, 265.2f, 325.6f, 275.8f, 314.0f, 275.8f)
                lineTo(314.0f, 275.8f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(183.7f, 151.8f)
                curveToRelative(9.9f, 0.3f, 14.9f, 10.3f, 13.6f, 22.2f)
                curveToRelative(-1.7f, 15.9f, -6.6f, 21.5f, -14.3f, 20.9f)
                curveToRelative(-10.6f, -0.7f, -11.6f, -10.3f, -11.6f, -22.2f)
                curveTo(171.7f, 160.8f, 176.0f, 151.5f, 183.7f, 151.8f)
                lineTo(183.7f, 151.8f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(216.2f, 251.6f)
                curveToRelative(-9.3f, 0.0f, -14.3f, -6.6f, -13.3f, -14.9f)
                curveToRelative(1.0f, -10.9f, 5.6f, -14.9f, 12.6f, -14.9f)
                curveToRelative(9.9f, 0.0f, 11.3f, 6.6f, 11.6f, 14.9f)
                curveTo(227.4f, 245.0f, 223.4f, 251.6f, 216.2f, 251.6f)
                lineTo(216.2f, 251.6f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(277.8f, 225.1f)
                curveToRelative(11.3f, 0.7f, 17.2f, 9.3f, 15.9f, 23.2f)
                curveToRelative(-1.7f, 18.6f, -7.3f, 28.2f, -16.2f, 27.5f)
                curveToRelative(-7.3f, -0.3f, -13.6f, -13.3f, -13.3f, -26.2f)
                curveTo(264.2f, 239.0f, 265.5f, 224.8f, 277.8f, 225.1f)
                lineTo(277.8f, 225.1f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(151.5f, 192.9f)
                curveToRelative(-8.6f, -0.3f, -12.9f, 4.6f, -12.3f, 12.6f)
                curveToRelative(1.0f, 10.9f, 5.0f, 16.9f, 11.6f, 17.2f)
                curveToRelative(5.6f, 0.0f, 10.3f, -7.0f, 10.6f, -14.6f)
                curveTo(161.4f, 201.9f, 160.5f, 193.3f, 151.5f, 192.9f)
                lineTo(151.5f, 192.9f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(111.7f, 169.4f)
                curveToRelative(10.6f, 0.3f, 15.9f, -8.6f, 15.3f, -19.6f)
                curveToRelative(-1.0f, -14.9f, -6.0f, -20.6f, -13.9f, -20.6f)
                curveToRelative(-10.9f, -0.3f, -12.6f, 8.6f, -12.9f, 19.6f)
                curveTo(99.8f, 159.8f, 103.8f, 169.1f, 111.7f, 169.4f)
                lineTo(111.7f, 169.4f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(152.5f, 273.5f)
                curveToRelative(10.9f, 0.7f, 16.9f, -6.3f, 15.9f, -17.9f)
                curveToRelative(-1.3f, -15.3f, -6.6f, -23.5f, -14.9f, -23.9f)
                curveToRelative(-7.0f, -0.3f, -13.3f, 9.6f, -13.6f, 20.2f)
                curveTo(139.9f, 261.2f, 140.9f, 273.2f, 152.5f, 273.5f)
                lineTo(152.5f, 273.5f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(410.4f, 303.0f)
                curveToRelative(10.9f, 0.0f, 15.9f, -10.3f, 13.9f, -22.9f)
                curveToRelative(-2.3f, -16.6f, -8.0f, -22.9f, -16.2f, -22.5f)
                curveToRelative(-11.3f, 0.3f, -12.3f, 9.9f, -11.9f, 22.5f)
                curveTo(397.2f, 292.7f, 402.1f, 303.0f, 410.4f, 303.0f)
                lineTo(410.4f, 303.0f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(420.4f, 142.9f)
                curveToRelative(10.6f, 0.0f, 15.6f, -7.3f, 13.9f, -19.2f)
                curveToRelative(-2.3f, -15.9f, -8.0f, -24.2f, -16.2f, -23.9f)
                curveToRelative(-6.6f, 0.0f, -11.9f, 10.9f, -11.6f, 21.5f)
                curveTo(407.1f, 130.3f, 408.8f, 142.9f, 420.4f, 142.9f)
                lineTo(420.4f, 142.9f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(206.2f, 80.5f)
                curveToRelative(9.9f, 0.0f, 15.3f, 7.3f, 14.3f, 19.2f)
                curveToRelative(-1.0f, 15.9f, -6.0f, 24.2f, -13.6f, 23.9f)
                curveToRelative(-6.3f, 0.0f, -11.9f, -10.9f, -12.3f, -21.5f)
                curveTo(194.6f, 92.8f, 195.3f, 80.5f, 206.2f, 80.5f)
                lineTo(206.2f, 80.5f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(316.9f, 55.0f)
                curveTo(306.0f, 55.4f, 301.0f, 66.6f, 303.0f, 79.9f)
                curveToRelative(3.0f, 17.9f, 8.6f, 24.2f, 17.2f, 23.5f)
                curveToRelative(11.6f, -0.7f, 12.6f, -11.6f, 11.6f, -24.9f)
                curveTo(330.9f, 65.3f, 325.6f, 54.7f, 316.9f, 55.0f)
                lineTo(316.9f, 55.0f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(186.0f, 240.3f)
                curveToRelative(-8.0f, 0.3f, -12.6f, -5.6f, -11.9f, -15.9f)
                curveToRelative(0.7f, -13.6f, 4.3f, -20.9f, 10.3f, -21.2f)
                curveToRelative(5.0f, -0.3f, 9.9f, 8.6f, 10.3f, 17.9f)
                curveTo(195.3f, 229.1f, 194.6f, 240.0f, 186.0f, 240.3f)
                lineTo(186.0f, 240.3f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(277.5f, 52.0f)
                curveToRelative(11.3f, 0.0f, 17.2f, 8.6f, 16.2f, 18.9f)
                curveToRelative(-1.3f, 13.9f, -6.6f, 19.2f, -15.3f, 18.9f)
                curveToRelative(-11.9f, -0.3f, -13.6f, -8.6f, -13.9f, -18.9f)
                curveTo(264.2f, 60.7f, 268.9f, 52.0f, 277.5f, 52.0f)
                lineTo(277.5f, 52.0f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(246.0f, 264.9f)
                curveToRelative(-9.0f, 0.3f, -13.9f, -8.0f, -13.6f, -18.2f)
                curveToRelative(0.3f, -13.9f, 4.6f, -18.9f, 11.6f, -19.2f)
                curveToRelative(9.6f, -0.3f, 11.3f, 8.0f, 11.9f, 18.2f)
                curveTo(256.3f, 255.9f, 253.0f, 264.5f, 246.0f, 264.9f)
                lineTo(246.0f, 264.9f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(350.4f, 153.5f)
                curveToRelative(10.6f, 0.0f, 15.6f, -9.9f, 13.9f, -21.9f)
                curveToRelative(-2.3f, -15.9f, -7.6f, -21.9f, -15.6f, -21.5f)
                curveToRelative(-11.3f, 0.3f, -12.3f, 9.6f, -11.6f, 21.5f)
                curveTo(337.5f, 143.9f, 342.1f, 153.5f, 350.4f, 153.5f)
                lineTo(350.4f, 153.5f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(249.3f, 185.6f)
                curveToRelative(10.6f, 0.0f, 15.9f, -6.3f, 14.6f, -16.2f)
                curveToRelative(-2.0f, -13.3f, -7.3f, -20.2f, -15.6f, -20.2f)
                curveToRelative(-6.6f, 0.0f, -12.3f, 9.0f, -12.3f, 18.2f)
                curveTo(236.4f, 175.4f, 238.0f, 185.6f, 249.3f, 185.6f)
                lineTo(249.3f, 185.6f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(283.1f, 185.6f)
                curveToRelative(-9.3f, 0.0f, -14.3f, -7.6f, -13.6f, -16.9f)
                curveToRelative(1.0f, -12.3f, 5.3f, -16.9f, 12.6f, -16.6f)
                curveToRelative(9.9f, 0.0f, 11.3f, 7.6f, 11.6f, 16.6f)
                curveTo(294.4f, 178.3f, 290.4f, 185.6f, 283.1f, 185.6f)
                lineTo(283.1f, 185.6f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(214.2f, 214.2f)
                curveToRelative(10.9f, 0.3f, 16.6f, -6.0f, 15.9f, -16.2f)
                curveToRelative(-1.3f, -13.9f, -6.6f, -21.2f, -14.9f, -21.2f)
                curveToRelative(-7.0f, 0.0f, -13.3f, 9.0f, -13.3f, 18.2f)
                curveTo(201.6f, 203.2f, 202.6f, 213.8f, 214.2f, 214.2f)
                lineTo(214.2f, 214.2f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(385.9f, 171.4f)
                curveToRelative(-9.3f, 0.0f, -14.3f, -8.3f, -13.6f, -18.2f)
                curveToRelative(0.7f, -13.6f, 5.0f, -18.2f, 12.3f, -18.2f)
                curveToRelative(9.6f, 0.3f, 11.3f, 8.3f, 11.9f, 18.2f)
                curveTo(396.5f, 163.1f, 393.2f, 171.4f, 385.9f, 171.4f)
                lineTo(385.9f, 171.4f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(217.5f, 166.4f)
                curveToRelative(-8.0f, 0.3f, -12.3f, -5.6f, -11.9f, -15.6f)
                curveToRelative(0.3f, -13.6f, 4.0f, -20.6f, 10.3f, -20.9f)
                curveToRelative(5.0f, -0.3f, 9.9f, 8.6f, 10.3f, 17.6f)
                curveTo(226.4f, 155.5f, 226.1f, 166.1f, 217.5f, 166.4f)
                lineTo(217.5f, 166.4f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(318.6f, 146.2f)
                curveToRelative(-9.0f, 0.3f, -13.9f, -7.6f, -13.6f, -17.6f)
                curveToRelative(0.3f, -13.3f, 4.3f, -18.6f, 11.3f, -18.6f)
                curveToRelative(9.3f, -0.3f, 11.3f, 7.6f, 11.9f, 17.6f)
                curveTo(328.5f, 137.6f, 325.6f, 145.9f, 318.6f, 146.2f)
                lineTo(318.6f, 146.2f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(312.6f, 152.2f)
                curveToRelative(10.3f, 0.0f, 15.6f, 7.3f, 14.9f, 19.2f)
                curveToRelative(-1.0f, 15.9f, -5.6f, 24.2f, -13.6f, 24.2f)
                curveToRelative(-6.6f, 0.0f, -12.6f, -10.9f, -12.9f, -21.5f)
                curveTo(301.0f, 164.4f, 301.7f, 152.2f, 312.6f, 152.2f)
                lineTo(312.6f, 152.2f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(284.8f, 221.1f)
                curveToRelative(-9.3f, 0.0f, -14.3f, -6.6f, -13.6f, -14.9f)
                curveToRelative(1.0f, -10.9f, 5.3f, -14.9f, 12.6f, -14.9f)
                curveToRelative(9.9f, 0.0f, 11.3f, 6.6f, 11.6f, 14.9f)
                curveTo(295.7f, 214.5f, 292.1f, 221.1f, 284.8f, 221.1f)
                lineTo(284.8f, 221.1f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(253.3f, 221.8f)
                curveToRelative(-9.0f, 0.3f, -13.9f, -6.0f, -13.6f, -13.6f)
                curveToRelative(0.7f, -10.3f, 4.6f, -14.3f, 11.6f, -14.3f)
                curveToRelative(9.6f, -0.3f, 11.3f, 6.0f, 11.6f, 13.6f)
                curveTo(263.2f, 215.5f, 259.9f, 221.8f, 253.3f, 221.8f)
                lineTo(253.3f, 221.8f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(365.7f, 193.9f)
                curveToRelative(-1.3f, -12.6f, 3.3f, -19.6f, 10.3f, -18.6f)
                curveToRelative(9.3f, 1.0f, 13.3f, 7.0f, 14.3f, 16.9f)
                curveToRelative(1.3f, 13.6f, -3.6f, 15.6f, -10.6f, 16.2f)
                curveTo(372.6f, 208.5f, 366.7f, 203.5f, 365.7f, 193.9f)
                lineTo(365.7f, 193.9f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(348.4f, 184.0f)
                curveToRelative(-7.0f, 0.3f, -10.9f, -3.6f, -10.6f, -10.3f)
                curveToRelative(0.3f, -9.0f, 3.3f, -13.6f, 9.0f, -13.6f)
                curveToRelative(4.3f, 0.0f, 8.6f, 5.6f, 9.3f, 11.6f)
                curveTo(356.1f, 176.7f, 355.7f, 183.7f, 348.4f, 184.0f)
                lineTo(348.4f, 184.0f)
                close()
            }
            path(fill = SolidColor(Color(0xFF0DB591)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(315.6f, 230.4f)
                curveToRelative(-9.0f, 0.3f, -13.9f, -6.0f, -13.6f, -13.6f)
                curveToRelative(0.3f, -10.3f, 4.6f, -14.3f, 11.3f, -14.6f)
                curveToRelative(9.6f, -0.3f, 11.3f, 6.0f, 11.9f, 13.6f)
                curveTo(325.9f, 223.8f, 322.6f, 230.1f, 315.6f, 230.4f)
                lineTo(315.6f, 230.4f)
                close()
            }
            path(fill = SolidColor(Color(0xFF000000)), stroke = null, strokeLineWidth = 0.0f,
                    strokeLineCap = Butt, strokeLineJoin = Miter, strokeLineMiter = 4.0f,
                    pathFillType = NonZero) {
                moveTo(176.6f, 588.4f)
                curveToRelative(0.0f, 3.6f, -0.7f, 7.0f, -2.0f, 10.1f)
                curveToRelative(-1.4f, 3.1f, -3.2f, 5.8f, -5.5f, 8.2f)
                curveToRelative(-2.3f, 2.3f, -5.1f, 4.2f, -8.2f, 5.5f)
                curveToRelative(-3.1f, 1.4f, -6.4f, 2.0f, -10.0f, 2.0f)
                curveToRelative(-3.5f, 0.0f, -6.9f, -0.7f, -10.0f, -2.0f)
                curveToRelative(-3.1f, -1.4f, -5.8f, -3.2f, -8.2f, -5.5f)
                curveToRelative(-2.3f, -2.3f, -4.2f, -5.1f, -5.5f, -8.2f)
                curveToRelative(-1.4f, -3.1f, -2.0f, -6.5f, -2.0f, -10.1f)
                verticalLineToRelative(-86.1f)
                lineTo(141.0f, 502.3f)
                verticalLineToRelative(84.5f)
                curveToRelative(0.0f, 4.0f, 0.9f, 6.9f, 2.8f, 8.7f)
                curveToRelative(1.9f, 1.9f, 4.2f, 2.8f, 7.0f, 2.8f)
                reflectiveCurveToRelative(5.1f, -0.9f, 7.0f, -2.8f)
                curveToRelative(1.9f, -1.9f, 2.8f, -4.8f, 2.8f, -8.7f)
                verticalLineToRelative(-84.5f)
                horizontalLineToRelative(15.9f)
                lineTo(176.5f, 588.4f)
                close()
            }
        }
        .build()
        return _trustrootsLogo!!
    }

private var _trustrootsLogo: ImageVector? = null
