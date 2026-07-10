import Script from "next/script";
import { homeTags } from "@/lib/home-tags";
import { STORAGE_PREFIX } from "@/lib/runtime-ids";

export function HomeTrendingBootstrap({
  coverHost,
  isCoverProxyEnabled,
}: {
  coverHost: string;
  isCoverProxyEnabled: boolean;
}) {
  return (
    <Script
      id="app-home-trending-bootstrap"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{
        __html: getBootstrapScript(isCoverProxyEnabled, coverHost),
      }}
    />
  );
}

function getBootstrapScript(isCoverProxyEnabled: boolean, coverHost: string) {
  const categories = JSON.stringify(homeTags.map((tag) => tag.id));
  const proxyEnabled = JSON.stringify(isCoverProxyEnabled);
  const host = JSON.stringify(coverHost);

  return `(function(){try{if(location.pathname!=="/")return;var categories=${categories};var params=new URLSearchParams(location.search);var requested=params.get("category");var category=categories.includes(requested)?requested:null;if(!category){try{var order=JSON.parse(localStorage.getItem("${STORAGE_PREFIX}v1:home-tag-order")||"[]");category=Array.isArray(order)?order.find(function(id){return categories.includes(id)}):null}catch(_){}}category=category||categories[0];var localeMatch=document.cookie.match(/(?:^|; )NEXT_LOCALE=([^;]*)/);var locale=localeMatch?decodeURIComponent(localeMatch[1]):"default";var cacheKey="${STORAGE_PREFIX}v1:neodb:trending:"+category;var cached=null;try{cached=JSON.parse(localStorage.getItem(cacheKey)||"null")}catch(_){}if(cached&&cached.cachedAt&&Date.now()-cached.cachedAt<3600000&&Array.isArray(cached.items)){preload(cached.items[0]);window.__appHomeTrendingBootstrap={category:category,promise:Promise.resolve({items:cached.items,fetchedAt:"",source:"cache"})};return}var promise=fetch("/api/neodb/trending?category="+encodeURIComponent(category)+"&limit=42&locale="+encodeURIComponent(locale)).then(function(response){if(!response.ok)throw new Error("Trending request failed");var first=response.headers.get("x-app-first-cover");if(first){try{preload({coverUrl:decodeURIComponent(first)})}catch(_){}}return response.json()}).then(function(data){if(data&&Array.isArray(data.items)){try{localStorage.setItem(cacheKey,JSON.stringify({cachedAt:Date.now(),items:data.items}))}catch(_){}preload(data.items[0])}return data});window.__appHomeTrendingBootstrap={category:category,promise:promise};promise.catch(function(){});function preload(item){var source=item&&item.coverUrl;if(!source)return;var href=source;if(${proxyEnabled}){try{var coverHost=${host};var url=new URL(source);if((url.protocol==="http:"||url.protocol==="https:")&&(url.hostname===coverHost||url.hostname==="neodb.social"||url.hostname.indexOf("neodb.")===0)&&(url.pathname.indexOf("/m/")===0||url.pathname.indexOf("/media/")===0)){href="/api/image/cover?url="+encodeURIComponent(source)}}catch(_){}}if(document.querySelector("link[data-app-home-cover]"))return;var link=document.createElement("link");link.rel="preload";link.as="image";link.href=href;link.fetchPriority="high";link.dataset.appHomeCover="true";document.head.appendChild(link)}}catch(_){}})();`;
}
