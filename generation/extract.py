import json
from unidecode import unidecode
import pandas as pd

CIV_COL = 'Civilization'
LEADER_COL = 'Leader'
NAME_COL = 'Theme'
MEM_1_COL = 'Memento 1'
MEM_2_COL = 'Memento 2'

with open('loc_mapper.json', 'r') as f:
    loc_mapping = json.load(f)

inverted_loc = {unidecode(val): key for key, val in loc_mapping.items()}
for key, val in loc_mapping.items():
    inverted_loc[val] = key

inverted_loc = {key: val.replace('LOC_', '').replace('_NAME', '') for key, val in inverted_loc.items()}

# oopsies. and for some reason i missed napoleons cross legion memento, but added to loc_mapper
inverted_loc['Shisha Necklace'] = 'LOC_MEMENTO_FOUNDATION_SHISA_NECKLACE_NAME'

generic_leader_types = {'SCIENTIFIC': ['LEADER_BENJAMIN_FRANKLIN', 'LEADER_CATHERINE', 'LEADER_CHARLEMAGNE', 'LEADER_CONFUCIUS', 'LEADER_FRIEDRICH', 'LEADER_HIMIKO', 'LEADER_TRUNG_TRAC',  'LEADER_ADA_LOVELACE'],
                        'CULTURAL': ['LEADER_AUGUSTUS', 'LEADER_CATHERINE', 'LEADER_HATSHEPSUT', 'LEADER_JOSE_RIZAL', 'LEADER_LAFAYETTE', 'LEADER_ADA_LOVELACE', 'LEADER_HIMIKO_ALT', 'LEADER_NAPOLEON_ALT', 'LEADER_XERXES_ALT'],
                        'ECONOMIC': ['LEADER_AMINA', 'LEADER_HATSHEPSUT', 'LEADER_ISABELLA', 'LEADER_MACHIAVELLI', 'LEADER_PACHACUTI', 'LEADER_XERXES', 'LEADER_NAPOLEON', 'LEADER_XERXES_ALT'],
                        'DIPLOMATIC': ['LEADER_ASHOKA', 'LEADER_BENJAMIN_FRANKLIN', 'LEADER_HARRIET_TUBMAN', 'LEADER_HIMIKO', 'LEADER_JOSE_RIZAL', 'LEADER_LAFAYETTE', 'LEADER_MACHIAVELLI', 'LEADER_ASHOKA_ALT', 'LEADER_HIMIKO_ALT', 'LEADER_NAPOLEON', 'LEADER_TECUMSEH'],
                        'EXPANSIONIST': ['LEADER_ASHOKA', 'LEADER_AUGUSTUS', 'LEADER_CONFUCIUS', 'LEADER_IBN_BATTUTA', 'LEADER_ISABELLA', 'LEADER_PACHACUTI' 'LEADER_BOLIVAR'],
                        'MILITARISTIC': ['LEADER_AMINA', 'LEADER_CHARLEMAGNE', 'LEADER_FRIEDRICH', 'LEADER_HARRIET_TUBMAN', 'LEADER_TRUNG_TRAC', 'LEADER_XERXES', 'LEADER_ASHOKA_ALT', 'LEADER_BOLIVAR', 'LEADER_NAPOLEON_ALT', 'LEADER_TECUMSEH', 'LEADER_FRIEDRICH_ALT'],
'SCIENCE': ['LEADER_BENJAMIN_FRANKLIN', 'LEADER_CATHERINE', 'LEADER_CHARLEMAGNE', 'LEADER_CONFUCIUS', 'LEADER_FRIEDRICH', 'LEADER_HIMIKO', 'LEADER_TRUNG_TRAC',  'LEADER_ADA_LOVELACE'],
'MILTARISTIC': ['LEADER_AMINA', 'LEADER_CHARLEMAGNE', 'LEADER_FRIEDRICH', 'LEADER_HARRIET_TUBMAN', 'LEADER_TRUNG_TRAC', 'LEADER_XERXES', 'LEADER_ASHOKA_ALT', 'LEADER_BOLIVAR', 'LEADER_NAPOLEON_ALT', 'LEADER_TECUMSEH', 'LEADER_FRIEDRICH_ALT'],
'MILITARY': ['LEADER_AMINA', 'LEADER_CHARLEMAGNE', 'LEADER_FRIEDRICH', 'LEADER_HARRIET_TUBMAN', 'LEADER_TRUNG_TRAC', 'LEADER_XERXES', 'LEADER_ASHOKA_ALT', 'LEADER_BOLIVAR', 'LEADER_NAPOLEON_ALT', 'LEADER_TECUMSEH', 'LEADER_FRIEDRICH_ALT'],
'CULTURE': ['LEADER_AUGUSTUS', 'LEADER_CATHERINE', 'LEADER_HATSHEPSUT', 'LEADER_JOSE_RIZAL', 'LEADER_LAFAYETTE', 'LEADER_ADA_LOVELACE', 'LEADER_HIMIKO_ALT', 'LEADER_NAPOLEON_ALT', 'LEADER_XERXES_ALT'],
'EXPANSION': ['LEADER_ASHOKA', 'LEADER_AUGUSTUS', 'LEADER_CONFUCIUS', 'LEADER_IBN_BATTUTA', 'LEADER_ISABELLA', 'LEADER_PACHACUTI' 'LEADER_BOLIVAR'],
'DIPLOMACY': ['LEADER_ASHOKA', 'LEADER_BENJAMIN_FRANKLIN', 'LEADER_HARRIET_TUBMAN','LEADER_HIMIKO', 'LEADER_JOSE_RIZAL', 'LEADER_LAFAYETTE', 'LEADER_MACHIAVELLI','LEADER_ASHOKA_ALT', 'LEADER_HIMIKO_ALT', 'LEADER_NAPOLEON', 'LEADER_TECUMSEH']

                        }
generic_leader_counter = {'SCIENTIFIC': 0, 'CULTURAL': 0, 'ECONOMIC': 0, 'DIPLOMATIC': 0, 'EXPANSIONIST': 0, 'MILITARISTIC': 0,
                          'MILTARISTIC': 0, 'SCIENCE': 0, 'CULTURE': 0, 'MILITARY': 0, 'EXPANSION': 0, 'DIPLOMACY': 0}

leader_list = []
for leadertype, leaders in generic_leader_types.items():
    for leader in leaders:
        leader_list.append(leader)
leader_list = set(leader_list)

oddities = {'Ashoka, WC': 'LEADER_ASHOKA', 'Ashoka, WR': 'LEADER_ASHOKA_ALT', 'Benjamin': 'LEADER_BENJAMIN_FRANKLIN',
            'Ada': 'LEADER_ADA_LOVELACE', 'Catherine': 'LEADER_CATHERINE', 'Trung': 'LEADER_TRUNG_TRAC',
            'Napoleon, E': 'LEADER_NAPOLEON', 'Napoleon, R': 'LEADER_NAPOLEON_ALT', 'Xerxes, KOK': 'LEADER_XERXES', 'Ashoka WC': 'LEADER_ASHOKA'}

combo_ids = {}
dupe_ids = {}
df = pd.read_excel("Civ Memento Synergies by Era.ods", engine="odf")
# df = pd.read_excel('Civ Memento Synergies by Era.xlsx')
split_points = df[df[CIV_COL].notna()]
keys = split_points[CIV_COL].tolist()
indices = split_points.index.tolist()
split_dfs = {
    keys[i]: df.iloc[indices[i]+1: indices[i+1]]
    for i in range(len(indices)-1)
}
nested_split_dfs = {}

for key, sub_df in split_dfs.items():
    sub_df_notna = sub_df[sub_df['Leader'].notna()]
    sub_keys = sub_df_notna['Leader'].tolist()
    sub_indices = sub_df_notna.index.tolist()

    relative_indices = [sub_df.index.get_loc(i) for i in sub_indices]

    inner_dict = {}
    for i in range(len(relative_indices) - 1):
        k = sub_keys[i]
        start = relative_indices[i]
        end = relative_indices[i + 1]
        inner_dict[k] = sub_df.iloc[start:end]

    nested_split_dfs[key] = inner_dict

def decode_loc(text):
    stripped_text = text.strip()
    found_loc = inverted_loc.get(stripped_text, None)
    if found_loc is None:
        formatted_text = unidecode(stripped_text)
        found_loc = inverted_loc.get(formatted_text, None)
    return found_loc

START_SQL = 'INSERT INTO SpecificMementoCombo(ComboID, LeaderType, CivilizationType, MementoTypePrimary, MementoTypeSecondary, AgeType) VALUES'

sql_list = []
for civ_name, df in nested_split_dfs.items():
    for combo_type, sub_df in df.items():
        for index, row in sub_df.iterrows():
            name = row[NAME_COL]
            if isinstance(name, float):
                continue
            name = name.replace("'", '')
            if 'GENERIC' in civ_name:
                civ = 'NULL'
            else:
                civ = f'LOC_CIVILIZATION_{civ_name}_NAME'
            leader = row[LEADER_COL]
            memento_one = decode_loc(row[MEM_1_COL])
            memento_two = decode_loc(row[MEM_2_COL])

            if isinstance(leader, float):
                leader = 'NULL'
            else:
                if leader not in leader_list and leader not in generic_leader_types:
                    if leader in oddities:
                        leader = oddities[leader]
                    else:
                        leader = decode_loc(leader)
                        if leader not in leader_list and leader not in generic_leader_types:
                           print('ERROR')
                leader = f"'{leader}'"
            if isinstance(civ, float):
                civ = 'NULL'
            else:
                civ = f"'{civ}'"
            if not isinstance(name, float):
                name = name.strip().replace(' ', '_').upper()

            if combo_type in generic_leader_types:
                for leader in generic_leader_types[combo_type]:
                    custom_name = f'{combo_type}_{leader}_GENERIC_{name}'
                    if 'GENERIC ' in civ_name:
                        age = civ_name.replace('GENERIC ', 'AGE_')
                        age = f"'{age}'"
                    else:
                        age = 'NULL'
                    entry = f"('{custom_name}', '{leader}', {civ}, '{memento_one}', '{memento_two}', {age})"
                    if custom_name in combo_ids:
                        dupe_ids[custom_name] = entry
                    else:
                        combo_ids[custom_name] = entry
                        sql_list.append(entry)
                generic_leader_counter[combo_type] += 1
            else:
                custom_leader_name = leader.replace("'", '')
                if civ == 'NULL':
                    custom_id = f'{custom_leader_name}_{name}'
                else:
                    if civ == "'Hawai'i'":
                        alt_civ = civ
                    else:
                        alt_civ = civ.replace("'", "").replace('LOC_', '').replace('_NAME', '').replace('CIVILIZATION_', '')
                    custom_id = f'{custom_leader_name}_{alt_civ}_{name}'.replace('LEADER_', '')
                entry = f"('{custom_id}', {leader}, {civ}, '{memento_one}', '{memento_two}', NULL)"
                if custom_leader_name in combo_ids:
                    combo_ids[custom_leader_name] = entry
                else:
                    dupe_ids[custom_leader_name] = entry
                    sql_list.append(entry)

START_SQL = START_SQL + '\n' + ',\n'.join(sql_list) + ';'
with open('gen_sql.sql', 'w') as f:
    f.write(START_SQL)
print('')
