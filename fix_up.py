with open('c:/tmp/up_part1.js', 'rb') as f1, open('c:/tmp/up_part2.js', 'rb') as f2, open('c:/tmp/up_part3.js', 'rb') as f3:
    content = f1.read() + f2.read() + f3.read()

text = content.decode('utf-8')

# 1. API Error handling
old_block = "const result = await response.json();\n        console.log('🌟 v2.1 result:', result);\n\n        if (result.is_invalid_image) {"
new_block = """const result = await response.json();
        console.log('🌟 v2.1 result:', result);

        if (result.error) {
            removeTypingIndicator();
            let errTxt = result.error + (result.detail ? " | " + result.detail : "");
            addThreadEntry("warning", "❌ API Error: " + errTxt);
            if (result.raw_response) { addThreadEntry("user", "Raw response: " + result.raw_response.substring(0,250) + "..."); }
            setStep(1);
            if (window.toast) window.toast.error("API Error: " + result.error);
            return;
        }

        if (result.is_invalid_image) {"""
text = text.replace(old_block, new_block)

# 2. Fix Emoji Mojibake
text = text.replace('🌿 ${plantLabel}', '&#127807; ${plantLabel}')

with open('e:/Foliage_Care/Frontend/js/up.js', 'wb') as out:
    out.write(text.encode('utf-8'))
print('Done writing up.js')
