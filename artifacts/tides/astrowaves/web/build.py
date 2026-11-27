import sys
body=open('web/app.html').read()
head='<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<link rel="icon" href="icon.svg">\n<link rel="manifest" href="manifest.json">\n<link rel="apple-touch-icon" href="icon-180.png">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="Astrowaves">\n<meta name="apple-mobile-web-app-status-bar-style" content="default">\n'
t=body.index('<style>'); 
full=head+body[:t]+body[t:body.index('</style>')+8]+'\n<style>:root{padding-top:env(safe-area-inset-top,0px)}</style>\n</head>\n<body>\n'+body[body.index('</style>')+8:]+'\n</body>\n</html>\n'
open('../static/waves/index.html','w').write(full)
core=open('../static/waves/core.js').read()
open('/dev/null','w').write(body.replace('<script src="./core.js"></script>','<script>\n'+core+'\n</script>'))
print('ok')
