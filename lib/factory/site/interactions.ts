import type {SiteInteractions} from "./types";

const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]!);
const fields={
  name:'<label>Your name<input name="name" autocomplete="name" required maxlength="100"></label>',
  email:'<label>Email address<input name="email" type="email" autocomplete="email" required maxlength="200"></label>',
  phone:'<label>Phone number<input name="phone" type="tel" autocomplete="tel" pattern="[+0-9\\(\\) .\\-]{7,30}" required maxlength="30"></label>',
  location:'<label>City or ZIP code<input name="location" autocomplete="off" required maxlength="100"></label>',
  message:'<label>Service concern<textarea name="message" rows="4" required maxlength="2000" placeholder="Tell us what you would like to discuss"></textarea></label>',
  preferredContact:'<label>Preferred contact method<select name="preferredContact"><option value="email">Email</option><option value="phone">Phone</option></select></label>',
  contactDetail:'<label>Contact detail<input name="contactDetail" type="email" autocomplete="email" required maxlength="200" placeholder="you@example.com"></label>',
};

/** Field controls and behavior are trusted code, never generated markup. */
export function configuredDemoForm(form:SiteInteractions["forms"][number]){
  return `<form data-demo-form class="contact-form">${form.fields.map(field=>fields[field]).join("")}<p class="form-note">Demo only—nothing is sent or stored.</p><button class="button button-primary" type="submit">${escape(form.submitLabel)} <span aria-hidden="true">↗</span></button><p data-demo-feedback role="status" tabindex="-1" hidden></p></form>`;
}

export const configuredFormRuntime=`document.querySelectorAll('[data-demo-form]').forEach(form=>{const method=form.querySelector('[name="preferredContact"]'),detail=form.querySelector('[name="contactDetail"]');if(method&&detail){const update=()=>{const phone=method.value==='phone';detail.type=phone?'tel':'email';detail.autocomplete=phone?'tel':'email';detail.placeholder=phone?'(555) 555-0123':'you@example.com';detail.maxLength=phone?30:200;if(phone)detail.pattern='[+0-9\\\\(\\\\) .\\\\-]{7,30}';else detail.removeAttribute('pattern');};method.addEventListener('change',update);update();}});`;
