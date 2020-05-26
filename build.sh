echo "" > build.html
sed '/<!--START-->/Q' index.html >> build.html
echo "<script>" >> build.html
cat event.js storage.js myself.js lp.js sbhighlight.js 12y.js bbcode.js render.js main.js >> build.html
echo "</script>" >> build.html
echo "<style>" >> build.html
cat style.css markup.css code.css >> build.html
echo "</style>" >> build.html


sed '1,/<!--END-->/d' index.html >> build.html
