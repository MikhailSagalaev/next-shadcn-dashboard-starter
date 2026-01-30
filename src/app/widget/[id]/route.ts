/**
 * @file: src/app/widget/[id]/route.ts
 * @description: Короткая ссылка-роут, который отдаёт бутлоадер виджета
 *   Пример использования: <script src="https://gupil.ru/widget/<projectId>"></script>
 *   Скрипт загружает public/tilda-bonus-widget.js и инициализирует его с projectId
 * @project: SaaS Bonus System
 * @dependencies: Next.js App Router
 * @created: 2025-09-22
 * @author: AI Assistant + User
 */

import { NextResponse, NextRequest } from 'next/server';
import { withApiRateLimit } from '@/lib';

// Генерируем компактный JS-лоадер с подстановкой projectId и платформы
function generateBootloaderJs(
  projectId: string,
  platform = 'tilda',
  widgetVersion = 'v=30'
) {
  // Логика загрузки:
  // 1. Определяем базовый URL скрипта (origin)
  // 2. Загружаем universal-widget.js
  // 3. Загружаем адаптер для платформы (по умолчанию tilda-adapter.js)
  // 4. Инициализируем ядро с адаптером

  /* Minified Bootloader */
  const js = `
(()=>{
  try {
    var origin;
    (function(){
      try{
        var cur=document.currentScript;
        if(cur&&cur.src){origin=new URL(cur.src,window.location.href).origin;}
        else{origin=window.location.origin;}
      }catch(_){origin=window.location.origin;}
    })();

    function loadScript(src) {
      return new Promise((resolve, reject) => {
        var s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    Promise.all([
      loadScript(origin + '/universal-widget.js?${widgetVersion}'),
      loadScript(origin + '/${platform}-adapter.js?${widgetVersion}')
    ]).then(() => {
      try {
        if (window.LeadWidgetCore && window.TildaAdapter) {
          var AdapterClass = window.TildaAdapter;
          var core = new window.LeadWidgetCore({
            projectId: '${projectId}',
            apiUrl: origin,
            debug: false,
            adapter: new AdapterClass({})
          });
          
          core.adapter.core = core;
          core.init();
          window.LeadWidget = core;
        }
      } catch (err) {
        console.error('LeadWidget Init Error:', err);
      }
    }).catch(err => {
      console.error('LeadWidget Load Error:', err);
    });

  } catch(_) {}
})();
`;
  return js;
}

async function handler(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const url = new URL(_req.url);
  const v = url.searchParams.get('v') || 'v=25';

  console.log(
    `[Widget Loader] Загружаем виджет для проекта ${id}, версия ${v}`
  );
  const js = generateBootloaderJs(id, v);

  const headers: Record<string, string> = {
    'Content-Type': 'application/javascript; charset=utf-8',
    'Cache-Control': 'public, max-age=86400, immutable', // 24h
    'X-Content-Type-Options': 'nosniff'
  };

  return new NextResponse(js, { status: 200, headers });
}

export const GET = withApiRateLimit(handler);
