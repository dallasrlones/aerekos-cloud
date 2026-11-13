#!/usr/bin/env python3
import json
import time
import urllib.request

API = 'https://cloudapi.aerekos.com'
SYS = '9d8bde11-6933-4732-b746-602dcf72eaa5'
VLLM = 'ca6751ea-9400-4ff0-958c-c70e00e4dd29'
INTEL = 'ff7a9b17-3821-402b-b432-b57794b78e2e'
AGENT = '453c979d-233d-437a-a10b-6a7db6d1a3c5'
MODEL = 'Huihui-Qwen3.8-27B-abliterated-AWQ-MTP'


def req(method, path, token=None, body=None):
    data = None if body is None else json.dumps(body).encode()
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    r = urllib.request.Request(API + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(r, timeout=90) as res:
        raw = res.read().decode()
        return json.loads(raw) if raw else {}


def main():
    key = open('/tmp/vllm_api_key').read().strip()
    token = None
    for pw in ('AerekosLiveTest1!', 'admin', 'AerekosAdmin1!'):
        try:
            body = req('POST', '/api/auth/login', body={'username': 'admin', 'password': pw})
            token = body.get('token')
            if token:
                print('login_ok')
                break
        except Exception as e:
            print('login_fail', type(e).__name__, e)
    if not token:
        raise SystemExit('no token')

    prov = req('GET', f'/api/services/ai_manager/api/v1/providers/{VLLM}?project_id={SYS}', token)
    row = prov.get('item') or prov
    opts = row.get('options') or {}
    if isinstance(opts, str):
        try:
            opts = json.loads(opts or '{}')
        except Exception:
            opts = {}
    opts['api_key'] = key
    patched = req(
        'PATCH',
        f'/api/services/ai_manager/api/v1/providers/{VLLM}?project_id={SYS}',
        token,
        {'options': opts, 'is_default': True, 'model': MODEL},
    )
    item = patched.get('item') or patched
    oo = item.get('options') or {}
    if isinstance(oo, str):
        try:
            oo = json.loads(oo)
        except Exception:
            oo = {}
    print('provider_ok', 'api_key' in oo)

    intel = req(
        'PATCH',
        f'/api/services/ai_manager/api/v1/intelligence/{INTEL}?project_id={SYS}',
        token,
        {'llm_integration': 'orin-vllm', 'model': MODEL},
    )
    print('intel', (intel.get('item') or intel).get('llm_integration'), (intel.get('item') or intel).get('model'))
    print('llm', req('GET', f'/api/services/ai_manager/api/v1/llm/status?project_id={SYS}', token))

    req('PATCH', f'/api/services/ai_manager/api/v1/agents/{AGENT}?project_id={SYS}', token, {'mode': 'ask'})
    chat = req(
        'POST',
        f'/api/services/ai_manager/api/v1/agents/{AGENT}/chat?project_id={SYS}',
        token,
        {'project_id': SYS, 'content': 'hi'},
    )
    print('chat', {k: chat.get(k) for k in ('job_id', 'handed_off', 'reply')})
    job_id = chat.get('job_id')
    if not job_id:
        return
    for _ in range(60):
        time.sleep(2)
        job = req('GET', f'/api/services/ai_manager/api/v1/intelligence/jobs/{job_id}?project_id={SYS}', token)
        j = job.get('job') or job
        if j.get('status') in ('succeeded', 'failed', 'cancelled'):
            print('job', j.get('status'), 'err', j.get('error'), 'partial', str(j.get('partial') or '')[:200])
            msgs = req('GET', f'/api/services/ai_manager/api/v1/agents/{AGENT}/messages?project_id={SYS}', token)
            items = msgs.get('items') or msgs or []
            last = items[-1] if items else {}
            print('last', last.get('role'), str(last.get('content') or '')[:400])
            return
    print('timeout')


if __name__ == '__main__':
    main()
