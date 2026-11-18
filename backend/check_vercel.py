import urllib.request

try:
    with urllib.request.urlopen('https://insurance-policy-and-management-sys.vercel.app/app.js') as response:
        print('app.js status:', response.status)
        content = response.read().decode('utf-8')
        print('app.js length:', len(content))
        print('First 200 chars:', content[:200])
        print('Has Server connection error:', 'Server connection error' in content)
except Exception as e:
    print('Error fetching app.js:', e)

try:
    with urllib.request.urlopen('https://insurance-policy-and-management-sys.vercel.app/') as response:
        print('index.html status:', response.status)
        content = response.read().decode('utf-8')
        print('index.html length:', len(content))
        for line in content.splitlines():
            if 'app.js' in line:
                print('Found script line:', line)
except Exception as e:
    print('Error fetching index:', e)
