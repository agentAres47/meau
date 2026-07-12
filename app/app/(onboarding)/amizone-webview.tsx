import { useRef, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { ChevronLeft } from 'lucide-react-native';
import { colors } from '../../theme/tokens';
import { useSession } from '../../store/session';
import { verifyWebview, type ScrapedProfile } from '../../lib/amizone';

const AMIZONE_URL = 'https://s.amizone.net/';

// Runs after every page load. Reports auth state; once on /IDCard, scrapes the
// profile from the ASP.NET label ids go-amizone used (stable on this internal
// page). Falls back to a text sample if the ids ever move, so we can re-target.
const SCRAPE_JS = `(function(){
  function post(o){try{window.ReactNativeWebView.postMessage(JSON.stringify(o));}catch(e){}}
  try{
    var loggedIn = !document.getElementById('loginform');
    var path = (location.pathname||'');
    if(!loggedIn){ post({type:'status',loggedIn:false}); return; }
    if(path.toLowerCase().indexOf('idcard')>=0){
      var front=document.getElementById('lblNameIDCardFront1');
      var back=document.getElementById('lblInfoIDCardBack1');
      if(front){
        var parts=(front.innerHTML||'').split(/<br\\s*\\/?>/i).map(function(s){return s.replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').trim();}).filter(function(s){return s.length;});
        var enroll='';
        if(back){ var m=(back.innerText||back.textContent||'').match(/Enrollment\\s*No\\.?\\s*:?\\s*([A-Za-z0-9]+)/i); if(m){enroll=m[1];} }
        post({type:'profile', full_name:(parts[0]||''), department:(parts[1]||''), batch:(parts[2]||''), amizone_id:enroll});
      } else {
        post({type:'no_fields', sample:((document.body&&document.body.innerText)||'').slice(0,500)});
      }
    } else {
      post({type:'status',loggedIn:true});
    }
  }catch(e){ post({type:'err',msg:String((e&&e.message)||e)}); }
})(); true;`;

export default function AmizoneWebview() {
  const ensureSession = useSession((s) => s.ensureSession);
  const refreshProfile = useSession((s) => s.refreshProfile);

  const webRef = useRef<WebView>(null);
  const navigatedToIdCard = useRef(false);
  const submitted = useRef(false);

  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitProfile(p: ScrapedProfile) {
    if (submitted.current) return;
    submitted.current = true;
    setWorking(true);
    setError(null);
    try {
      const token = await ensureSession();
      await verifyWebview({ token, profile: p });
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

    if (msg.type === 'status' && msg.loggedIn === true && !navigatedToIdCard.current) {
      // Logged in — jump to the ID card page to read the profile.
      navigatedToIdCard.current = true;
      webRef.current?.injectJavaScript("window.location.href='/IDCard';true;");
      return;
    }

    if (msg.type === 'profile') {
      const amizone_id = String(msg.amizone_id ?? '').trim();
      const full_name = String(msg.full_name ?? '').trim();
      if (!amizone_id || !full_name) {
        setError("Couldn't read your Amizone profile. Try again.");
        navigatedToIdCard.current = false;
        return;
      }
      submitProfile({
        amizone_id,
        full_name,
        department: String(msg.department ?? '').trim() || null,
        batch: String(msg.batch ?? '').trim() || null,
      });
      return;
    }

    if (msg.type === 'no_fields') {
      setError("Reached your Amizone account but couldn't find the profile fields. Tap back and try again.");
    }
  }

  function retry() {
    setError(null);
    navigatedToIdCard.current = false;
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
        onLoadEnd={() => webRef.current?.injectJavaScript(SCRAPE_JS)}
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
          <Text className="text-muted text-sm mt-3">Reading your Amizone profile…</Text>
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
