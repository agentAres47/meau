import { useRef, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { ChevronLeft, ShieldCheck } from 'lucide-react-native';
import { colors } from '../../theme/tokens';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useSession } from '../../store/session';
import { verifyWebview } from '../../lib/amizone';

const AMIZONE_URL = 'https://s.amizone.net/';

// Injected on the login page: fills the given credentials, then polls for the
// Cloudflare Turnstile token (populated once the human ticks the box) and
// auto-submits. The password lives only inside this injected script's execution
// in the WebView — never logged or stored.
function loginScript(id: string, password: string): string {
  const U = JSON.stringify(id);
  const P = JSON.stringify(password);
  return `(function(){
    function post(o){try{window.ReactNativeWebView.postMessage(JSON.stringify(o));}catch(e){}}
    try{
      var form=document.getElementById('loginform');
      if(!form){ post({type:'status',loggedIn:true}); return; }
      var u=document.getElementById('_UserName'), p=document.getElementById('_Password');
      if(u && !u.value){ u.value=${U}; u.dispatchEvent(new Event('input',{bubbles:true})); u.dispatchEvent(new Event('change',{bubbles:true})); }
      if(p && !p.value){ p.value=${P}; p.dispatchEvent(new Event('input',{bubbles:true})); p.dispatchEvent(new Event('change',{bubbles:true})); }
      post({type:'status',loggedIn:false});
      if(!window.__meauPoll){
        window.__meauPoll=setInterval(function(){
          var tok=document.querySelector('[name=cf-turnstile-response]');
          if(tok && tok.value){
            clearInterval(window.__meauPoll); window.__meauPoll=null;
            post({type:'submitting'});
            try{ if(form.requestSubmit){ form.requestSubmit(); } else { form.submit(); } }catch(e){ form.submit(); }
          }
        }, 400);
      }
    }catch(e){ post({type:'err',msg:String((e&&e.message)||e)}); }
  })(); true;`;
}

// After we've submitted, just report auth state — never re-fill or re-submit
// (avoids a loop on wrong credentials).
const CHECK_JS = `(function(){try{window.ReactNativeWebView.postMessage(JSON.stringify({type:'status',loggedIn:!document.getElementById('loginform')}));}catch(e){}})();true;`;

export default function AmizoneWebview() {
  const ensureSession = useSession((s) => s.ensureSession);
  const refreshProfile = useSession((s) => s.refreshProfile);

  const webRef = useRef<WebView>(null);
  const idRef = useRef('');
  const pwRef = useRef('');
  const submitted = useRef(false);
  const done = useRef(false);

  const [phase, setPhase] = useState<'creds' | 'browser'>('creds');
  const [amizoneId, setAmizoneId] = useState('');
  const [password, setPassword] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startLogin() {
    setError(null);
    if (!amizoneId.trim() || !password) {
      setError('Enter your Amizone ID and password.');
      return;
    }
    idRef.current = amizoneId.trim();
    pwRef.current = password;
    submitted.current = false;
    done.current = false;
    setPhase('browser');
  }

  async function completeVerification() {
    if (done.current) return;
    done.current = true;
    setWorking(true);
    try {
      const token = await ensureSession();
      await verifyWebview({ token, profile: { amizone_id: idRef.current } });
      pwRef.current = ''; // drop the password once we're done with it
      setPassword('');
      await refreshProfile();
      router.replace('/(onboarding)/complete-profile');
    } catch (e) {
      done.current = false;
      failBackToCreds(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }

  function failBackToCreds(message: string) {
    submitted.current = false;
    setWorking(false);
    setError(message);
    setPhase('creds');
  }

  function onMessage(e: WebViewMessageEvent) {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'submitting') {
      submitted.current = true;
      setWorking(true); // hide the Amizone page behind our loading screen
      return;
    }
    if (msg.type === 'status') {
      if (msg.loggedIn === true) {
        completeVerification();
      } else if (submitted.current) {
        // Back on the login page after submitting = bad credentials / turnstile.
        failBackToCreds('Amizone login failed. Check your Amizone ID and password.');
      }
    }
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

      {phase === 'creds' ? (
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View className="flex-1 px-6 pt-6">
            <Text className="text-muted text-sm mb-8">
              Enter your Amizone login. We use it once to verify you're an Amity member — your
              password is never saved.
            </Text>
            <View className="gap-4">
              <Input
                label="Amizone ID"
                placeholder="Your Amizone login ID"
                autoCapitalize="none"
                autoCorrect={false}
                value={amizoneId}
                onChangeText={setAmizoneId}
              />
              <Input
                label="Password"
                placeholder="Amizone password"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                value={password}
                onChangeText={setPassword}
                error={error ?? undefined}
              />
            </View>
          </View>
          <View className="px-6 pb-4">
            <Button label="Continue" onPress={startLogin} />
          </View>
        </KeyboardAvoidingView>
      ) : (
        <View className="flex-1">
          {!working ? (
            <View className="flex-row items-center gap-2 px-4 py-3 bg-surface border-b border-surface2">
              <ShieldCheck color={colors.accent} size={18} />
              <Text className="text-text text-sm flex-1">
                Tick “Verify you are human” below to finish.
              </Text>
            </View>
          ) : null}

          <WebView
            ref={webRef}
            source={{ uri: AMIZONE_URL }}
            onMessage={onMessage}
            onLoadEnd={() =>
              webRef.current?.injectJavaScript(
                submitted.current ? CHECK_JS : loginScript(idRef.current, pwRef.current)
              )
            }
            javaScriptEnabled
            domStorageEnabled
            thirdPartyCookiesEnabled
            sharedCookiesEnabled
            userAgent="Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"
            style={{ flex: 1, backgroundColor: colors.bg }}
          />
        </View>
      )}

      {working ? (
        <View className="absolute inset-0 bg-bg items-center justify-center">
          <ActivityIndicator color={colors.accent} />
          <Text className="text-muted text-sm mt-3">Signing you in…</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
