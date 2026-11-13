#!/usr/bin/env python3
"""Point icarus-brain at orin-vllm with API key from Orin jetson-vllm env."""
import json
import os
import subprocess
import urllib.request

API = os.environ.get('AEREKOS_API_URL', 'https://cloudapi.aerekos.com').rstrip('/')
SYS = '9d8bde11-6933-4732-b746-602dcf72eaa5'
VLLM_ID = 'ca6751ea-9400-4ff0-958c-c70e00e4dd29'
INTEL_ID = 'ff7a9b17-3821-402b-b432-b57794b78e2e'
AGENT_ID = '453c979d-233d-437a-a10b-6a7db6d1a3c5'


def req(method, path, token=None, body=None):
    data = None if body is None else json.dumps(body).encode()
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    r = urllib.request.Request(API + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(r, timeout=60) as res:
        raw = res.read().decode()
        return res.status, json.loads(raw) if raw else {}


def main():
    key = subprocess.check_output(
        ['ssh', '-o', 'ConnectTimeout=20', 'orin.aerekos.com', 'cat /tmp/vllm_api_key'],
        text=True,
    ).strip()
    assert key, 'missing vllm api key'

    token = None
    for pw in ('AerekosLiveTest1!', 'admin', 'AerekosAdmin1!'):
        try:
            _, body = req('POST', '/api/auth/login', body={'username': 'admin', 'password': pw})
            token = body.get('token')
            if token:
                break
        except Exception:
            continue
    assert token, 'admin login failed'

    _, prov = req('GET', f'/api/services/ai_manager/api/v1/providers/{VLLM_ID}?project_id={SYS}', token)
    row = prov.get('item') or prov
    opts = row.get('options') or {}
    if isinstance(opts, str):
        try:
            opts = json.loads(opts or '{}')
        except Exception:
            opts = {}
    opts['api_key'] = key
    # keep model aligned with what vLLM serves
    model = 'Huihui-Qwen3.8-27B-abliterated-AWQ-MTP'
    _, patched = req(
        'PATCH',
        f'/api/services/ai_manager/api/v1/providers/{VLLM_ID}?project_id={SYS}',
        token,
        {'options': opts, 'is_default': True, 'model': model},
    )
    item = patched.get('item') or patched
    print('provider', item.get('name'), 'default', item.get('is_default'), 'has_api_key', 'api_key' in (json.loads(item['options']) if isinstance(item.get('options'), str) else (item.get('options') or {})))

    _, intel = req(
        'PATCH',
        f'/api/services/ai_manager/api/v1/intelligence/{INTEL_ID}?project_id={SYS}',
        token,
        {'llm_integration': 'orin-vllm', 'model': model},
    )
    ii = intel.get('item') or intel
    print('intel', ii.get('llm_integration'), ii.get('model'))

    _, st = req('GET', f'/api/services/ai_manager/api/v1/llm/status?project_id={SYS}', token)
    print('llm_status', st)

    # force ask mode + chat hi
    req('PATCH', f'/api/services/ai_manager/api/v1/agents/{AGENT_ID}?project_id={SYS}', token, {'mode': 'ask'})
    status, chat = req(
        'POST',
        f'/api/services/ai_manager/api/v1/agents/{AGENT_ID}/chat?project_id={SYS}',
        token,
        {'project_id': SYS, 'content': 'hi'},
    )
    print('chat', status, {k: chat.get(k) for k in ('job_id', 'handed_off', 'reply')})
    job_id = chat.get('job_id')
    if not job_id:
        return
    import time
    for _ in range(60):
        time.sleep(2)
        _, job = req('GET', f'/api/services/ai_manager/api/v1/intelligence/jobs/{job_id}?project_id={SYS}', token)
        j = job.get('job') or job
        stt = j.get('status')
        if stt in ('succeeded', 'failed', 'cancelled'):
            print('job', stt, 'error', j.get('error'), 'partial', str(j.get('partial') or '')[:200])
            _, msgs = req('GET', f'/api/services/ai_manager/api/v1/agents/{AGENT_ID}/messages?project_id={SYS}', token)
            items = msgs.get('items') or msgs or []
            last = items[-1] if items else {}
            print('last_msg', last.get('role'), str(last.get('content') or '')[:300])
            break
    else:
        print('job timeout')


if __name__ == '__main__':
    main()
