import { useRef, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { ChevronLeft } from 'lucide-react-native';
import { colors } from '../../theme/tokens';
import { useSession } from '../../store/session';
import { verifyWebview } from '../../lib/amizone';

const AMIZONE_URL = 'https://s.amizone.net/';

// Runs after every page load. On the login page it captures the Amizone ID from
// the username field as the user types (that's our account key — reliable, and
// login itself is the proof of membership). When the login form is gone, the
// user has reached their account = verified.
const HOOK_JS = `(function(){
  function post(o){try{window.ReactNativeWebView.postMessage(JSON.stringify(o));}catch(e){}}
  try{
    if(document.getElementById('loginform')){
      var u=document.getElementById('_UserName');
      if(u && !u.__meau){
        u.__meau=true;
        ['input','change','blur'].forEach(function(ev){
          u.addEventListener(ev,function(){ var v=(u.value||'').trim(); if(v){ post({type:'id',v:v}); } });
        });
      }
      post({type:'status',loggedIn:false});
    } else {
      post({type:'status',loggedIn:true});
    }
  }catch(e){ post({type:'err',msg:String((e&&e.message)||e)}); }
})(); true;`;

export default function AmizoneWebview() {
  const ensureSession = useSession((s) => s.ensureSession);
  const refreshProfile = useSession((s) => s.refreshProfile);

  const webRef = useRef<WebView>(null);
  const amizoneId = useRef('');
  const submitted = useRef(false);

  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function completeVerification() {
    if (submitted.current) return;
    if (!amizoneId.current) {
      setError("Couldn't read your Amizone ID. Tap Start over and log in again.");
      return;
    }
    submitted.current = true;
    setWorking(true);
    setError(null);
    try {
      const token = await ensureSession();
      await verifyWebview({ token, profile: { amizone_id: amizoneId.current } });
      await refreshProfile();
      router.replace('/(onboarding)/complete-profile');
    } catch (e) {
      submitted.current = false;
      setWorking(false);
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }

  function onMessage(e: WebViewMessageEvent) {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'id') {
      const v = String(msg.v ?? '').trim();
      if (v) amizoneId.current = v;
      return;
    }
    if (msg.type === 'status' && msg.loggedIn === true) {
      completeVerification();
    }
  }

  function retry() {
    setError(null);
    submitted.current = false;
    webRef.current?.injectJavaScript(`window.location.href='${AMIZONE_URL}';true;`);
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
      <View className="px-4 pt-2 pb-2 flex-row items-center">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          className="w-10 h-10 -ml-2 items-center justify-center active:opacity-60"
        >
          <ChevronLeft color={colors.text} size={24} />
        </Pressable>
        <Text className="text-text text-base font-semibold">Log in to Amizone</Text>
      </View>

      <WebView
        ref={webRef}
        source={{ uri: AMIZONE_URL }}
        onMessage={onMessage}
        onLoadEnd={() => webRef.current?.injectJavaScript(HOOK_JS)}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        userAgent="Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"
        style={{ flex: 1, backgroundColor: colors.bg }}
      />

      {working ? (
        <View className="absolute inset-0 bg-bg/90 items-center justify-center">
          <ActivityIndicator color={colors.accent} />
          <Text className="text-muted text-sm mt-3">Verifying…</Text>
        </View>
      ) : null}

      {error ? (
        <View className="absolute bottom-0 left-0 right-0 bg-surface border-t border-surface2 p-4">
          <Text className="text-danger text-sm mb-3">{error}</Text>
          <Pressable
            onPress={retry}
            accessibilityRole="button"
            className="bg-surface2 rounded-xl py-3 items-center active:scale-[0.97]"
          >
            <Text className="text-text font-semibold">Start over</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
