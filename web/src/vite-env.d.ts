/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GUEST_VERIFY_EMAIL_API?: string;
  readonly VITE_EMAILJS_SERVICE_ID?: string;
  readonly VITE_EMAILJS_TEMPLATE_ID?: string;
  readonly VITE_EMAILJS_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
