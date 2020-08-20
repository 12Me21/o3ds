echo "" > build.html

sed '/<!--START-->/Q' index.html >> build.html

echo "<style>" >> build.html
cat fonts.css style.css markup.css code.css >> build.html
echo "</style>" >> build.html

echo "<script>" >> build.html
./sbs2-markup/build.sh
cat util.js myself.js lp4.js sbs2-markup/_build.js render.js view.js events.js main.js >> build.html
echo "</script>" >> build.html

sed '1,/<!--END-->/d' index.html >> build.html
