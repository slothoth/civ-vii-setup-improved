import sqlite3
import json

SQL_PATH = "C:/Users/Sam/AppData/Local/Firaxis Games/Sid Meier's Civilization VII/Debug/frontend-copy.sqlite"
SQL_PATH_LOC = "C:/Users/Sam/AppData/Local/Firaxis Games/Sid Meier's Civilization VII/Debug/localization-copy.sqlite"
conn = sqlite3.connect(SQL_PATH)
cursor = conn.cursor()

cursor.execute("SELECT * FROM Mementos")
rows = cursor.fetchall()

mapper = {}
for row in rows:
    name = row[3]
    mapper[name] = ''

cursor.execute("SELECT * FROM Leaders")
rows = cursor.fetchall()

for row in rows:
    name = row[2]
    mapper[name] = ''


cursor.execute("SELECT * FROM Civilizations")
rows = cursor.fetchall()

for row in rows:
    name = row[2]
    mapper[name] = ''

cursor.close()
conn = sqlite3.connect(SQL_PATH_LOC)
cursor = conn.cursor()

cursor.execute("SELECT * FROM LocalizedText")
rows = cursor.fetchall()
keyed_rows = {i[1]: i[2] for i in rows if i[0] == 'en_US'}
cursor.close()
for map_entry in mapper:
    translation = keyed_rows.get(map_entry)
    if translation is not None:
        mapper[map_entry] = translation
    else:
        print('error!', map_entry)

with open('loc_mapper_1.json', 'w') as f:
    f.write(json.dumps(mapper))
