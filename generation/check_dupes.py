with open('version_3_combos.sql', 'r') as file:
    lines = file.readlines()

ids = []
for line in lines:
    if 'INSERT INTO' in line:
        continue
    ids.append(line.split("'")[1:2][0])


extras = {}
unique_extras = []
for i in ids:
    if i in extras:
        unique_extras.append(i)
    extras[i] = ''

print('')