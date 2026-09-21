# SR.Automates website — John Gladys S

Your portfolio as a real website: free hosting on GitHub Pages, an editing panel at `/admin/`, and everything Google needs to find you by your name and your company name.

```
content/            ← ALL the words, lists, links and photo paths (edited by the admin panel)
  seo.json            Google title, description, verification codes
  profile.json        name, company, city, photos, availability
  hero.json           top of the page, rotating phrases, ticker
  about.json          statement, bio, facts, numbers
  services.json       services and process steps
  work.json           projects
  experience.json     timeline, skills, awards, certifications
  contact.json        email, phone, social links, form options
src/                ← the DESIGN
  1-head.html         styles and colours      (search "EDIT: COLOURS")
  2-body.html         page layout
  3-scripts.html      animation and WebGL     (search "EDIT: SCENE" for background palettes)
  visuals/*.svg       project illustrations
static/             ← copied to the site as-is
  admin/              the editing panel (Sveltia CMS)
  images/             photos, share image, uploads
build.js            ← joins content + design into dist/ (no npm packages needed)
.github/workflows/  ← builds and publishes the site on every change
```

---

## 1. Put it online (free, about 15 minutes)

You need a free GitHub account. The links on your site already point to `github.com/JohnGladys2005`, so these steps use that name.

1. **Create a repository** named exactly `JohnGladys2005.github.io` and make it **Public**.
   This name gives you the free address **https://johngladys2005.github.io/** with no extra folder in the URL, which is better for Google.
   (Using another name? Your address becomes `https://johngladys2005.github.io/REPO-NAME`, so put that address in `content/seo.json` → `site_url` and in `static/admin/config.yml` → `repo`, `site_url`, `display_url`.)

2. **Upload everything in this folder**, keeping the structure, including the hidden `.github` folder.
   With Git installed, run this inside the folder:
   ```
   git init
   git add .
   git commit -m "First version of the website"
   git branch -M main
   git remote add origin https://github.com/JohnGladys2005/JohnGladys2005.github.io.git
   git push -u origin main
   ```
   Uploading by drag-and-drop on github.com often skips the hidden `.github` folder. If that happens, click **Add file → Create new file**, type the name `.github/workflows/deploy.yml`, and paste in the contents of that file from this folder.

3. In the repository, open **Settings → Pages**, and under **Build and deployment → Source** choose **GitHub Actions**.

4. Open the **Actions** tab. The **Build and deploy** run takes about a minute. When it shows a green tick, your site is live at https://johngladys2005.github.io/

---

## 2. Edit the website from the admin panel

1. Open **https://johngladys2005.github.io/admin/**
2. Click **Sign In Using Access Token**. The dialog links to GitHub's token settings page. Create a *fine-grained* token with **Repository access: Only select repositories** (pick this one) and **Contents: Read and write**, give it an expiry date, then copy it and paste it into the dialog.
3. Pick a section (Projects, About, Contact…), change what you like, press **Save**.
4. GitHub rebuilds the site automatically. It's live in about a minute (you can watch it in the **Actions** tab).

**Photos:** use the image fields. Uploads are stored in `static/images/uploads/`. For a new project, set **Illustration** to "Use the image uploaded below".

**Bold text:** in bio paragraphs and timeline text, wrap words in `**double stars**`.

**Security:** the token stays in your browser only. Don't share it, give it an expiry date, and create a new one when it expires. Nobody without write access to your repository can change the site.

### Editing on your own computer (optional)
Needs [Node.js](https://nodejs.org) 18 or newer.
```
node build.js --serve
```
Open http://localhost:8080 to see the site, and http://localhost:8080/admin/ in Chrome or Edge, then choose **Work with Local Repository** and select this folder. Changes are saved to your disk and the preview rebuilds on its own. When you're happy, commit and push.

---

## 3. Show up when people search your name or company

Already built in: an optimised title and description, a canonical address, share previews for LinkedIn/WhatsApp/X (with the image in `static/images/og-image.jpg`), structured data telling Google that **John Gladys S** is a person who founded **SR.Automates** in Chennai, `sitemap.xml`, `robots.txt`, and fast static HTML.

What you do once it's live:

1. **Google Search Console** — go to https://search.google.com/search-console, **Add property → URL prefix**, enter your site address. Choose the **HTML tag** method and copy the code. In the admin panel open **Google and social sharing**, paste it into **Google Search Console verification code**, press Save, wait a minute for the deploy, then click **Verify** in Search Console.
2. In Search Console open **Sitemaps** and submit `sitemap.xml`.
3. Open **URL inspection**, paste your homepage address, and click **Request indexing**.
4. **Bing Webmaster Tools** (https://www.bing.com/webmasters) — sign in and import your site from Search Console. This covers Bing and other engines that use Bing's index.
5. **Link to your site from everywhere you already exist:** LinkedIn (Contact info → Website, and a Featured link), your GitHub profile's website field, Instagram bio, WhatsApp Business profile, email signature, hackathon and college profiles. These links are how Google connects the name "John Gladys S" and the name "SR.Automates" to this site.
6. **Google Business Profile** for SR.Automates (https://business.google.com) as a service-area business in Chennai, with your site as the website. This is the single strongest step for people searching the company name.
7. Use exactly the same spelling everywhere: **John Gladys S** and **SR.Automates**.

Expect indexing within a few days to a couple of weeks. With a distinctive name and the profile links above, you'd normally reach the first page for your own name and company once indexed, but no one can guarantee rankings.

---

## 4. Use your own domain (recommended)

A domain like `srautomates.com` or `srautomates.in` looks professional and helps company-name searches. Buy it from any registrar, then:

1. Repository **Settings → Pages → Custom domain**: enter your domain (for example `srautomates.com`) and Save.
2. At your registrar's DNS settings add:
   - four **A** records for `@` pointing to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - one **CNAME** record for `www` pointing to `johngladys2005.github.io`
3. When GitHub shows the certificate is ready, tick **Enforce HTTPS** (this can take up to a day).
4. Admin panel → **Google and social sharing** → **Website address**: change it to `https://srautomates.com` and Save. Also update `site_url` and `display_url` in `static/admin/config.yml`.
5. Add the new address as another property in Search Console and submit `sitemap.xml` there too.

---

## 5. Changing the design

- **Colours:** `src/1-head.html`, search `EDIT: COLOURS`.
- **Cinematic background palettes and camera:** `src/3-scripts.html`, search `EDIT: SCENE`.
- **Layout and section order:** `src/2-body.html`.
- **How lists are drawn** (projects, services, timeline…): the `render()` function in `build.js`.
- **New project illustration:** add an `.svg` to `src/visuals/`, then add it to the Illustration options in `static/admin/config.yml`.

Preview any change with `node build.js --serve`.

---

## 6. If something goes wrong

- **Actions run is red:** open it. A message starting with `BUILD FAILED:` says exactly what to fix (for example an invalid website address).
- **Admin says it can't find the repository:** check `repo:` in `static/admin/config.yml`, and that your token has access to that repository.
- **Change not visible:** wait for the Actions run to finish, then hard-refresh the page (Ctrl+F5, or Cmd+Shift+R on Mac).
- **Contact form:** it opens the visitor's own email app with everything filled in, so no server is needed.
- **The admin panel changed or broke after an update:** Sveltia CMS is still in beta. You can pin a version by changing the script in `static/admin/index.html` to `https://unpkg.com/@sveltia/cms@0.217.0/dist/sveltia-cms.js`.
