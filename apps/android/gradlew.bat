@rem Trustroots Android Gradle launcher
@if "%OS%"=="Windows_NT" setlocal
@set APP_HOME=%~dp0
@set CLASSPATH=%APP_HOME%\gradle\wrapper\gradle-wrapper.jar
@if defined JAVA_HOME goto findJavaFromJavaHome
@set JAVA_EXE=java.exe
@goto execute
:findJavaFromJavaHome
@set JAVA_EXE=%JAVA_HOME%\bin\java.exe
:execute
@"%JAVA_EXE%" -Xmx64m -Xms64m -classpath "%CLASSPATH%" org.gradle.wrapper.GradleWrapperMain %*
@if "%OS%"=="Windows_NT" endlocal
