import { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { ChevronLeft, ShieldCheck } from 'lucide-react-native';
import { colors } from '../../theme/tokens';
import { Button } from '../../components/Button';
import { useSession } from '../../store/session';
import { verifyWebview } from '../../lib/amizone';

const AMIZONE_URL = 'https://s.amizone.net/';

// Runs after every page load. On the login page it captures the Amizone ID from
// the username field (that's our account key; login itself is the proof of
// membership). The Amizone inputs have name="_UserName" but NO id, so we must
// select by name — reading as the user types and again at submit. When the login
// form is gone (and it's not the error page), the user is verified.
const HOOK_JS = `(function(){
  function post(o){try{window.ReactNativeWebView.postMessage(JSON.stringify(o));}catch(e){}}
  function grab(el){ if(!el) return; var v=(el.value||'').trim(); if(v){ post({type:'id',v:v}); } }
  try{
    var form=document.getElementById('loginform');
    if(form){
      var inputs=document.querySelectorAll('input[name="_UserName"]');
      for(var i=0;i<inputs.length;i++){
        (function(node){
          grab(node);
          if(!node.__meau){ node.__meau=true;
            node.addEventListener('input',function(){ grab(node); });
            node.addEventListener('change',function(){ grab(node); });
            node.addEventListener('blur',function(){ grab(node); });
          }
        })(inputs[i]);
      }
      if(!form.__meauS){ form.__meauS=true; form.addEventListener('submit',function(){ grab(form.querySelector('input[name="_UserName"]')); }); }
      post({type:'status',loggedIn:false});
    } else {
      post({type:'status',loggedIn: location.href.toLowerCase().indexOf('error')<0});
    }
  }catch(e){ post({type:'err',msg:String((e&&e.message)||e)}); }
})(); true;`;

export default function AmizoneWebview() {
  const ensureSession = useSession((s) => s.ensureSession);
  const refreshProfile = useSession((s) => s.refreshProfile);

  const webRef = useRef<WebView>(null);
  const idRef = useRef('');
  const loginPageSeen = useRef(false);
  const submitted = useRef(false);
  const done = useRef(false);

  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function completeVerification() {
    if (done.current) return;
    if (!idRef.current) {
      hardFail("Couldn't read your Amizone ID. Tap Try again.");
      return;
    }
    done.current = true;
    setWorking(true);
    try {
      const token = await ensureSession();
      await verifyWebview({ token, profile: { amizone_id: idRef.current } });
      await refreshProfile();
      router.replace('/(onboarding)/complete-profile');
    } catch (e) {
      hardFail(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }

  // A recoverable dead-end (network/timeout/no id): show an error with a retry
  // that reloads Amizone fresh.
  function hardFail(message: string) {
    done.current = false;
    submitted.current = false;
    loginPageSeen.current = false;
    setWorking(false);
    setError(message);
  }

  function retry() {
    setError(null);
    done.current = false;
    submitted.current = false;
    loginPageSeen.current = false;
    idRef.current = '';
    webRef.current?.injectJavaScript(`window.location.href='${AMIZONE_URL}';true;`);
  }

  // Watchdog: the loader must never spin forever.
  useEffect(() => {
    if (!working) return;
    const t = setTimeout(() => {
      hardFail('That took too long. Check your connection and try again.');
    }, 30000);
    return () => clearTimeout(t);
  }, [working]);

  function onMessage(e: WebViewMessageEvent) {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'id') {
      const v = String(msg.v ?? '').trim();
      if (v) idRef.current = v;
      return;
    }
    if (msg.type === 'status') {
      if (msg.loggedIn === true) {
        completeVerification();
      } else {
        // On a login page. If we just submitted, the creds were rejected —
        // Amizone re-renders its own error, so just drop our loader and let the
        // user retry in the page.
        loginPageSeen.current = true;
        if (submitted.current) {
          submitted.current = false;
          setWorking(false);
        }
      }
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
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

      {!working && !error ? (
        <View className="flex-row items-center gap-2 px-4 py-3 bg-surface border-b border-surface2">
          <ShieldCheck color={colors.accent} size={18} />
          <Text className="text-text text-sm flex-1">
            Log in and tick “Verify you are human”. We never see your password.
          </Text>
        </View>
      ) : null}

      <WebView
        ref={webRef}
        source={{ uri: AMIZONE_URL }}
        onMessage={onMessage}
        onLoadStart={(e) => {
          const url = e.nativeEvent.url ?? '';
          // A main-frame navigation after the login page = the login submit.
          if (loginPageSeen.current && !submitted.current && url.toLowerCase().includes('amizone.net')) {
            submitted.current = true;
            setWorking(true); // hide the page behind our loader
          }
        }}
        onLoadEnd={() => webRef.current?.injectJavaScript(HOOK_JS)}
        // Fresh session every time — no remembered Amizone login, so the password
        // is always actually verified and the id capture always runs.
        incognito
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        userAgent="Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"
        style={{ flex: 1, backgroundColor: colors.bg }}
      />

      {working ? (
        <View className="absolute inset-0 bg-bg items-center justify-center">
          <ActivityIndicator color={colors.accent} />
          <Text className="text-muted text-sm mt-3">Signing you in…</Text>
        </View>
      ) : null}

      {error ? (
        <View className="absolute bottom-0 left-0 right-0 bg-surface border-t border-surface2 p-4">
          <Text className="text-danger text-sm mb-3">{error}</Text>
          <Button label="Try again" variant="secondary" onPress={retry} />
        </View>
      ) : null}
    </Screen>
  );
}
