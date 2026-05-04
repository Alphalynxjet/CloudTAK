<template>
    <div style='height:100vh; background:#0d0d0d;'>
        <!-- Login screen -->
        <div
            v-if='!authed'
            style='display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; gap:16px; color:#fff;'
        >
            <div style='font-size:1.2rem; font-weight:600; margin-bottom:4px;'>Video Wall</div>
            <div style='color:rgba(255,255,255,0.45); font-size:0.85rem; margin-bottom:8px;'>Sign in to CloudTAK to continue</div>
            <input
                v-model='username'
                placeholder='Username'
                style='padding:8px 14px; border-radius:6px; border:1px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.07); color:#fff; font-size:0.9rem; width:240px; outline:none;'
                @keyup.enter='login'
            />
            <input
                v-model='password'
                type='password'
                placeholder='Password'
                style='padding:8px 14px; border-radius:6px; border:1px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.07); color:#fff; font-size:0.9rem; width:240px; outline:none;'
                @keyup.enter='login'
            />
            <div v-if='loginError' style='color:#fc8181; font-size:0.8rem;'>{{ loginError }}</div>
            <button
                :disabled='logging'
                style='padding:8px 28px; border-radius:6px; border:none; background:#2563eb; color:#fff; font-size:0.9rem; cursor:pointer; font-weight:500;'
                @click='login'
            >
                {{ logging ? 'Signing in…' : 'Sign in' }}
            </button>
        </div>

        <!-- Video wall -->
        <VideoWall v-else />
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import VideoWall from '../../components/VideoWall/Main.vue';

const authed = ref(false);
const username = ref('');
const password = ref('');
const loginError = ref('');
const logging = ref(false);

onMounted(() => {
    if (localStorage.token) authed.value = true;
});

async function login() {
    if (!username.value || !password.value) return;
    logging.value = true;
    loginError.value = '';
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username.value, password: password.value })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Login failed');
        localStorage.token = data.token;
        authed.value = true;
    } catch (err) {
        loginError.value = err instanceof Error ? err.message : 'Login failed';
    } finally {
        logging.value = false;
    }
}
</script>
