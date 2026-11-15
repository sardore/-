import random
import heapq
from collections import deque
import pygame
import math








# =========================
# Persistent Ranking




RANK_TOP = 10
RANKINGS = []  # in-memory only




def add_ranking_in_memory(name, score):
  global RANKINGS
  name = (name or "NONAME").strip()
  if not name:
      name = "NONAME"
  name = name[:18]
  score = int(score)
  RANKINGS.append({"name": name, "score": score})
  RANKINGS.sort(key=lambda x: x["score"], reverse=True)
  RANKINGS = RANKINGS[:RANK_TOP]
  return RANKINGS








# =========================
# Symbols
# =========================
WALL = "■"
EMPTY = " "
DOOR = "□"
FURN = "A"
WIN  = "+"
MON  = "B"
STAIR_UP   = ">"
ELEV_BROKE = "X"
ELEV_OK    = "O"
GEM = "*"
POTION_GROUND = "!"        # 필드 싸구려 포션(50%로 1HP)
AMULET_GROUND = "^"        # 수호의 부적
TUTOR_EXIT = "T"           # 튜토 탈출 타일
WEAPON_GROUND = "V"        # 바닥 무기 드랍
TICKET_GROUND = "U"        # 무기 강화권(영롱)




# =========================
# Tile OOP (behavior attached to tile)
# =========================
class Tile:
   """A tile knows how to behave when stepped on, and whether it's walkable/blocking."""
   walkable = True
   blocking = False


   def on_step(self, player, grid, particles, score_add_fn,
               ground_weapons, ground_tickets, treasure_cells):
       # return message string (or "")
       return ""


   # optional: for future, you can add draw() here (later patch)




class WallTile(Tile):
   walkable = False
   blocking = True




class FurnTile(Tile):
   walkable = False
   blocking = True




class FloorTile(Tile):
   walkable = True
   blocking = False




class DoorTile(Tile):
   walkable = True
   blocking = False




class WinTile(Tile):
   walkable = True
   blocking = False




class StairUpTile(Tile):
   walkable = True
   blocking = False




class ElevOkTile(Tile):
   walkable = True
   blocking = False




class ElevBrokeTile(Tile):
   walkable = True
   blocking = False




class TutorExitTile(Tile):
   walkable = True
   blocking = False




class GemTile(Tile):
   walkable = True
   blocking = False


   def on_step(self, player, grid, particles, score_add_fn,
               ground_weapons, ground_tickets, treasure_cells):
       y, x = player.pos
       grid[y][x] = EMPTY
       player.gems += 1
       score_add_fn(SCORE_GEM)
       lvmsg = player.gain_xp(XP_GEM)
       spawn_break_fx(particles, x, y, amount=10, kind="spark")
       return lvmsg if lvmsg else "+1 gem!"




class PotionGroundTile(Tile):
   walkable = True
   blocking = False


   def on_step(self, player, grid, particles, score_add_fn,
               ground_weapons, ground_tickets, treasure_cells):
       y, x = player.pos
       if player.try_add_item_to_slot(CheapPotionItem()):
           grid[y][x] = EMPTY
           spawn_break_fx(particles, x, y, amount=10, kind="spark")
           return "Picked cheap potion."
       return "Inventory full. Can't pick."




class AmuletGroundTile(Tile):
   walkable = True
   blocking = False


   def on_step(self, player, grid, particles, score_add_fn,
               ground_weapons, ground_tickets, treasure_cells):
       y, x = player.pos
       if player.try_add_item_to_slot(AmuletItem()):
           grid[y][x] = EMPTY
           spawn_break_fx(particles, x, y, amount=14, kind="spark")
           return "Picked amulet!"
       return "Inventory full. Can't pick."




class TicketGroundTile(Tile):
   walkable = True
   blocking = False


   def on_step(self, player, grid, particles, score_add_fn,
               ground_weapons, ground_tickets, treasure_cells):
       y, x = player.pos
       if player.try_add_item_to_slot(TicketItem()):
           grid[y][x] = EMPTY
           ground_tickets.pop((y, x), None)
           spawn_break_fx(particles, x, y, amount=18, kind="spark")
           return "Picked Ticket!"
       return "Inventory full. Ticket stays."




class WeaponGroundTile(Tile):
   walkable = True
   blocking = False


   def on_step(self, player, grid, particles, score_add_fn,
               ground_weapons, ground_tickets, treasure_cells):
       y, x = player.pos
       item = ground_weapons.get((y, x))
       if not item:
           return ""


       ok, msg2 = item.on_pickup(player)
       if ok:
           grid[y][x] = EMPTY
           ground_weapons.pop((y, x), None)
           spawn_break_fx(particles, x, y, amount=16, kind="spark")


           if player.equipped_idx is None:
               for i, it in enumerate(player.inv):
                   if isinstance(it, WeaponItem):
                       player.equipped_idx = i
                       break


           return f"Picked weapon: {WEAPONS[item.wtype]['name']} Lv{item.level}."
       else:
           return msg2


# =========================
# Weapons / Items / Inventory
# =========================
WEAPONS = {
  "AXE":    {"name":"Axe",    "base_cool_ms":1700, "range":2, "dmg_equiv":3, "cool_scale":0.94, "break_furn":False},
  "SPEAR":  {"name":"Spear",  "base_cool_ms":1500, "range":4, "dmg_equiv":2, "cool_scale":0.95, "break_furn":False},
  "SWORD":  {"name":"Sword",  "base_cool_ms":1200, "range":3, "dmg_equiv":2, "cool_scale":0.93, "break_furn":False},
  "SHIELD": {"name":"Shield", "base_cool_ms":1800, "range":2, "dmg_equiv":1, "cool_scale":0.97, "break_furn":False},
  "HAMMER": {"name":"Hammer", "base_cool_ms":1650, "range":3, "dmg_equiv":3, "cool_scale":0.94, "break_furn":True},
}


ITEM_POTION = "POTION"
ITEM_CHEAP  = "CHEAP_POTION"
ITEM_WEAPON = "WEAPON"
ITEM_PET    = "PET"
ITEM_AMULET = "AMULET"
ITEM_MAXHP_PCT = "MAXHP_PCT"
ITEM_TICKET = "TICKET"


POTION_HEAL = 3
MAXHP_PCT_STEP = 0.10
# 몬스터 기본 HP를 1로 (소수 대응)
MONSTER_BASE_HP = 1.0




# =========================
# Item OOP (FINAL)
# =========================
class Item:
   TYPE = None
   NAME = "Item"


   def on_use(self, player, idx):
       return "Nothing happens."


   def on_pickup(self, player):
       # always store a CLONE in inventory (safe)
       if player.has_free_slot():
           player.try_add_item_to_slot(self.clone())
           return True, f"Picked {self.NAME}."
       return False, "Inventory full."


   def clone(self):
       return self  # override if needed






class PotionItem(Item):
   TYPE = ITEM_POTION
   NAME = "Potion"


   def on_use(self, player, idx):
       if player.hp >= player.max_hp:
           return "HP full."
       player.hp = min(player.max_hp, player.hp + POTION_HEAL)
       player.inv[idx] = None
       return f"Healed +{POTION_HEAL}."




class CheapPotionItem(Item):
   TYPE = ITEM_CHEAP
   NAME = "Cheap Potion"


   def on_use(self, player, idx):
       player.inv[idx] = None
       if player.hp >= player.max_hp:
           return "HP full."
       if random.random() < 0.5:
           player.hp = min(player.max_hp, player.hp + 1)
           return "Cheap potion worked! +1 HP."
       return "Cheap potion failed..."




class AmuletItem(Item):
   TYPE = ITEM_AMULET
   NAME = "Amulet"


   def on_use(self, player, idx):
       player.inv[idx] = None
       return "__USE_AMULET__"




class TicketItem(Item):
   TYPE = ITEM_TICKET
   NAME = "Ticket"


   def on_use(self, player, idx):
       player.inv[idx] = None
       return player.use_ticket()




class WeaponItem(Item):
   TYPE = ITEM_WEAPON


   def __init__(self, wtype, level=1):
       self.wtype = wtype
       self.level = level
       self.NAME = f"{WEAPONS[wtype]['name']} Lv{level}"


   def clone(self):
       return WeaponItem(self.wtype, self.level)


   def on_use(self, player, idx):
       return player.equip_weapon_slot(idx)






# Tile registry
TILES = {
   WALL: WallTile(),
   FURN: FurnTile(),
   EMPTY: FloorTile(),
   DOOR: DoorTile(),
   WIN: WinTile(),
   STAIR_UP: StairUpTile(),
   ELEV_OK: ElevOkTile(),
   ELEV_BROKE: ElevBrokeTile(),
   GEM: GemTile(),
   POTION_GROUND: PotionGroundTile(),
   AMULET_GROUND: AmuletGroundTile(),
   WEAPON_GROUND: WeaponGroundTile(),
   TICKET_GROUND: TicketGroundTile(),
   TUTOR_EXIT: TutorExitTile(),
}


def tile_of(ch: str) -> Tile:
   return TILES.get(ch, FloorTile())






BORDER = 1




# Floors
# Floors (EXPANSION)
# 1~9 일반, 10은 일반의 끝(상점/난이도 상승) 느낌으로 남기고
# 11~19 어둠테마, 20 보스 추천(가장 깔끔)
MAX_NORMAL_FLOOR = 19


# ✅ PATCH: 보스층 통합(중간/최종을 한 리스트로)
FINAL_BOSS_FLOOR = 20  # 게임 목표층 (표기용으로만 유지)
BOSS_FLOORS = {10, 20} # 여기만 보스 아레나
MID_BOSS_FLOOR = 10    # (호환용) 기존 코드가 참조하면 깨지지 않게 남김








# =========================
# Config (Zoom / View)
# =========================
TILE = 30
UI_H = 96
FPS = 60
FOV_RADIUS = 13




MON_MOVE_MS = 340
ATTACK_FLASH_MS = 160
SNIPER_WARN_MS = 280




# Screen effects
HIT_FLASH_MS = 140
HIT_SHAKE_MS = 170


# =========================
# THEMES (NORMAL / DARK)
# =========================
THEME_NORMAL = "NORMAL"
THEME_DARK   = "DARK"


def get_theme_for_floor(floor: int):
   """
   1~10: NORMAL
   11~20: DARK
   """
   if 11 <= floor <= 20:
       return THEME_DARK
   return THEME_NORMAL


THEME_DATA = {
   THEME_NORMAL: {
       # map gen
       "w": 60, "h": 30,
       "corridor_spacing": 10,
       "corridor_width": 3,
       "room_count": 14,


       # placements
       "furn_density": 0.06,
       "windows_per_side": 5,
       "gem_base": 6,
       "potion_base": 3,


       # difficulty knobs
       "sniper_bias": 0.0,      # 0이면 기존 로직 거의 그대로
       "digger_bonus": 0.0,
       "fov": 13,


       # render colors (visible / non-visible)
       "col_floor_vis": (60, 55, 78),
       "col_wall_vis":  (150, 150, 178),
       "col_floor_dim": (10, 10, 16),
       "col_wall_dim":  (26, 26, 44),
       "col_treasure":  (95, 55, 145),
   },


   THEME_DARK: {
       # 어둠테마: 복도 더 촘촘/가늘게, 방 더 많게
       "w": 60, "h": 30,              # 살짝 크게(원하면 60x30 유지해도 됨)
       "corridor_spacing": 8,
       "corridor_width": 2,
       "room_count": 18,


       # 어둠테마: 가구 더 빽빽, 창문 적게(분위기)
       "furn_density": 0.09,
       "windows_per_side": 2,
       "gem_base": 7,                 # 보상 조금↑
       "potion_base": 3,


       # 어둠 난이도: 스나이퍼/디거 확률 가산
       "sniper_bias": 0.12,
       "digger_bonus": 0.10,


       # 시야 살짝 감소(“어둠” 체감)
       "fov": 6,


       # render: 더 어둡고 보라/남색 계열
       "col_floor_vis": (34, 30, 50),
       "col_wall_vis":  (120, 110, 155),
       "col_floor_dim": (4, 4, 9),
       "col_wall_dim":  (16, 16, 30),
       "col_treasure":  (80, 30, 140),
   }
}


def theme_cfg(floor: int):
   return THEME_DATA[get_theme_for_floor(floor)]






# =========================
# I-frames / Knockback
# =========================
PLAYER_HURT_IFRAMES_MS = 400
MELEE_KNOCKBACK_TILES = 1




# =========================
# Angel balance
# =========================
ANGEL_SLOW_MS = 1600
ANGEL_SLOW_MULT = 0.70
ANGEL_MISSILE_DAMAGE = 0.1
ANGEL_MISSILE_RANGE = 11
ANGEL_BASE_FIRE_MS = 900
ANGEL_TWO_FIRE_MS = 650




# =========================
# Scoring / XP
# =========================
SCORE_GEM = 10
SCORE_KILL = 50
SCORE_KILL_ANGEL = 40
SCORE_FLOOR_ADVANCE = 200
SCORE_BOSS_HIT = 3
SCORE_BOSS_KILL = 1200
ENDING_MULT = 1.5




XP_GEM = 1
XP_KILL = 5
XP_FLOOR_ADVANCE = 10




BASE_HP_START = 6
BASE_HP_CAP = 18
XP_PER_BASE_HP = 25  # XP 25당 기본 최대체력 +1




# =========================
# Utils / Map Gen Core
# =========================
def in_bounds(h, w, y, x):
  return 0 <= y < h and 0 <= x < w




def in_inner(h, w, y, x, border=BORDER):
  return border <= y < h - border and border <= x < w - border




def seal_borders(building, border=BORDER):
  h, w = len(building), len(building[0])
  for y in range(h):
      for x in range(w):
          if not in_inner(h, w, y, x, border):
              building[y][x] = WALL




def make_corridor_grid(building, spacing=10, width=3, border=BORDER):
  h, w = len(building), len(building[0])
  y0, y1 = border, h - border
  x0, x1 = border, w - border




  for y in range(y0, y1, spacing):
      for dy in range(width):
          yy = y + dy
          if yy >= y1: break
          for x in range(x0, x1):
              building[yy][x] = EMPTY




  for x in range(x0, x1, spacing):
      for dx in range(width):
          xx = x + dx
          if xx >= x1: break
          for y in range(y0, y1):
              building[y][xx] = EMPTY




def carve_room(building, rx, ry, rw, rh, border=BORDER):
  h, w = len(building), len(building[0])
  if rx < border or ry < border: return False
  if rx + rw > w - border or ry + rh > h - border: return False




  for y in range(ry, ry + rh):
      for x in range(rx, rx + rw):
          if y in (ry, ry + rh - 1) or x in (rx, rx + rw - 1):
              building[y][x] = WALL
          else:
              building[y][x] = EMPTY
  return True




def place_doors(building, rx, ry, rw, rh, max_doors=2, border=BORDER):
  h, w = len(building), len(building[0])
  candidates = []


  def is_walkable_cell(ch):
      return is_walkable(ch)


  def add_if_valid(door_y, door_x, out_y, out_x, in_y, in_x):
      if not in_inner(h, w, door_y, door_x, border): return
      if building[door_y][door_x] != WALL: return
      if not (in_bounds(h, w, out_y, out_x) and in_bounds(h, w, in_y, in_x)): return
      if not (in_inner(h, w, out_y, out_x, border) and in_inner(h, w, in_y, in_x, border)): return
      if is_walkable_cell(building[out_y][out_x]) and is_walkable_cell(building[in_y][in_x]):
          candidates.append((door_y, door_x))




  for x in range(rx + 1, rx + rw - 1):
      add_if_valid(ry, x, ry - 1, x, ry + 1, x)
      add_if_valid(ry + rh - 1, x, ry + rh, x, ry + rh - 2, x)




  for y in range(ry + 1, ry + rh - 1):
      add_if_valid(y, rx, y, rx - 1, y, rx + 1)
      add_if_valid(y, rx + rw - 1, y, rx + rw, y, rx + rw - 2)




  random.shuffle(candidates)
  for (y, x) in candidates[:max_doors]:
      building[y][x] = DOOR




def remove_diagonal_doors(building, border=BORDER):
  h, w = len(building), len(building[0])
  to_remove = []
  for y in range(border, h - border):
      for x in range(border, w - border):
          if building[y][x] == DOOR:
              ok = False
              for dy, dx in ((0,1),(0,-1),(1,0),(-1,0)):
                  ny, nx = y + dy, x + dx
                  if in_inner(h, w, ny, nx, border) and is_walkable(building[ny][nx]):
                      ok = True
                      break
              if not ok:
                  to_remove.append((y, x))
  for y, x in to_remove:
      building[y][x] = WALL




def bfs_region_empty_only(building, start, border=BORDER):
  h, w = len(building), len(building[0])
  q = deque([start])
  visited = {start}
  while q:
      y, x = q.popleft()
      for dy, dx in ((0,1),(0,-1),(1,0),(-1,0)):
          ny, nx = y + dy, x + dx
          if in_inner(h, w, ny, nx, border) and (ny, nx) not in visited and building[ny][nx] == EMPTY:
              visited.add((ny, nx))
              q.append((ny, nx))
  return visited




def bfs_walkable(building, start, border=BORDER):
  h, w = len(building), len(building[0])
  q = deque([start])
  visited = {start}
  while q:
      y, x = q.popleft()
      for dy, dx in ((0,1),(0,-1),(1,0),(-1,0)):
          ny, nx = y + dy, x + dx
          if in_inner(h, w, ny, nx, border) and (ny, nx) not in visited:
              if is_walkable(building[ny][nx]):
                  visited.add((ny, nx))
                  q.append((ny, nx))
  return visited




def shortest_cost_path(building, starts, goals, border=BORDER, wall_cost=1):
  h, w = len(building), len(building[0])
  INF = 10**9
  dist = [[INF] * w for _ in range(h)]
  prev = {}
  pq = []




  for (sy, sx) in starts:
      if in_inner(h, w, sy, sx, border):
          dist[sy][sx] = 0
          heapq.heappush(pq, (0, sy, sx))




  goal_set = set([g for g in goals if in_inner(h, w, g[0], g[1], border)])
  if not goal_set:
      return None




  best_goal = None
  while pq:
      d, y, x = heapq.heappop(pq)
      if d != dist[y][x]:
          continue
      if (y, x) in goal_set:
          best_goal = (y, x)
          break
      for dy, dx in ((0,1),(0,-1),(1,0),(-1,0)):
          ny, nx = y + dy, x + dx
          if not in_inner(h, w, ny, nx, border):
              continue
          cell = building[ny][nx]
          cost = 0 if is_walkable(cell) else wall_cost
          nd = d + cost
          if nd < dist[ny][nx]:
              dist[ny][nx] = nd
              prev[(ny, nx)] = (y, x)
              heapq.heappush(pq, (nd, ny, nx))




  if best_goal is None:
      return None




  path = []
  cur = best_goal
  while cur in prev:
      path.append(cur)
      cur = prev[cur]
  path.append(cur)
  path.reverse()
  return path




def carve_path_and_place_door(building, path, connected_set, border=BORDER):
  if not path:
      return
  conn = set(connected_set)




  join_idx = None
  for i, p in enumerate(path):
      if p in conn:
          join_idx = i
          break




  for (y, x) in path:
      if in_inner(len(building), len(building[0]), y, x, border) and building[y][x] == WALL:
          building[y][x] = EMPTY




  if join_idx is not None and join_idx > 0:
      by, bx = path[join_idx - 1]
      building[by][bx] = DOOR




  remove_diagonal_doors(building, border=border)




def all_empty_cells(building, border=BORDER):
  h, w = len(building), len(building[0])
  return {(y, x) for y in range(border, h - border) for x in range(border, w - border) if building[y][x] == EMPTY}




def ensure_connectivity(building, base_corridors, border=BORDER):
  h, w = len(building), len(building[0])
  base = [c for c in base_corridors
          if in_inner(h, w, c[0], c[1], border) and building[c[0]][c[1]] == EMPTY]
  if not base:
      return
  connected = bfs_walkable(building, base[0], border=border)




  while True:
      start = None
      for y in range(border, h - border):
          for x in range(border, w - border):
              if building[y][x] == EMPTY and (y, x) not in connected:
                  start = (y, x)
                  break
          if start:
              break
      if not start:
          break




      region = bfs_region_empty_only(building, start, border=border)
      path = shortest_cost_path(building, list(region), list(connected), border=border, wall_cost=1)
      if path:
          carve_path_and_place_door(building, path, connected, border=border)
          connected = bfs_walkable(building, base[0], border=border)
      else:
          break




  remove_diagonal_doors(building, border=border)




def generate_building(width=60, height=30, corridor_spacing=10, corridor_width=3, room_count=14, seed=None, border=BORDER):
  if seed is not None:
      random.seed(seed)




  building = [[WALL for _ in range(width)] for _ in range(height)]
  seal_borders(building, border=border)
  make_corridor_grid(building, spacing=corridor_spacing, width=corridor_width, border=border)
  base_corridors = list(all_empty_cells(building, border=border))




  corridors = set(base_corridors)
  placed = 0
  attempts = room_count * 8
  rooms = []




  while placed < room_count and attempts > 0:
      attempts -= 1
      if not corridors:
          break




      rw = random.randint(6, 12)
      rh = random.randint(5, 8)
      cy, cx = random.choice(list(corridors))




      if random.choice([True, False]):
          side = random.choice([-1, 1])
          rx = cx + (1 if side == 1 else -rw - 1)
          ry = cy - rh // 2
      else:
          side = random.choice([-1, 1])
          ry = cy + (1 if side == 1 else -rh - 1)
          rx = cx - rw // 2




      rx = max(border, min(width - border - rw, rx))
      ry = max(border, min(height - border - rh, ry))




      if carve_room(building, rx, ry, rw, rh, border=border):
          place_doors(building, rx, ry, rw, rh, max_doors=2, border=border)
          rooms.append((rx, ry, rw, rh))
          placed += 1
          corridors = all_empty_cells(building, border=border)




  ensure_connectivity(building, base_corridors, border=border)
  seal_borders(building, border=border)
  remove_diagonal_doors(building, border=border)
  return building, rooms




# =========================
# Walkability
# =========================
def neighbors4(y,x):
  return ((y+1,x),(y-1,x),(y,x+1),(y,x-1))




def is_blocking(ch):
   return tile_of(ch).blocking


def is_walkable(ch):
   return tile_of(ch).walkable






# =========================
# Furniture safe placement
# =========================
def all_walkable_cells(building):
  h, w = len(building), len(building[0])
  out = []
  for y in range(BORDER, h-BORDER):
      for x in range(BORDER, w-BORDER):
          if is_walkable(building[y][x]) and not is_blocking(building[y][x]):
              out.append((y,x))
  return out




def bfs_walkable_set(building, start):
  h, w = len(building), len(building[0])
  q = deque([start])
  vis = {start}
  while q:
      y, x = q.popleft()
      for ny,nx in neighbors4(y,x):
          if not in_bounds(h,w,ny,nx): continue
          if (ny,nx) in vis: continue
          if not (BORDER <= ny < h-BORDER and BORDER <= nx < w-BORDER): continue
          if is_walkable(building[ny][nx]) and building[ny][nx] not in (WALL, FURN):
              vis.add((ny,nx))
              q.append((ny,nx))
  return vis




def would_keep_connectivity(building):
  walk = all_walkable_cells(building)
  if not walk:
      return True
  vis = bfs_walkable_set(building, walk[0])
  return len(vis) == len(walk)




def is_bad_furn_spot(building, y, x):
  h, w = len(building), len(building[0])
  for ny,nx in neighbors4(y,x):
      if in_bounds(h,w,ny,nx) and building[ny][nx] == DOOR:
          return True
  cnt = 0
  for ny,nx in neighbors4(y,x):
      if in_bounds(h,w,ny,nx) and is_walkable(building[ny][nx]) and building[ny][nx] not in (WALL, FURN):
          cnt += 1
  return cnt <= 1




def place_furniture_safe(building, density=0.06, max_trials=9000):
  h, w = len(building), len(building[0])
  empties = [(y,x) for y in range(BORDER, h-BORDER) for x in range(BORDER, w-BORDER) if building[y][x] == EMPTY]
  random.shuffle(empties)
  target = int(len(empties) * density)
  placed = 0
  trials = 0




  while empties and placed < target and trials < max_trials:
      trials += 1
      y,x = empties.pop()
      if is_bad_furn_spot(building, y, x):
          continue
      building[y][x] = FURN
      if not would_keep_connectivity(building):
          building[y][x] = EMPTY
          continue
      placed += 1
  return placed




# =========================
# Other placements
# =========================
def place_windows(building, per_side=5, border=BORDER):
  h, w = len(building), len(building[0])
  candidates = []




  y = border - 1
  if y >= 0:
      for x in range(border+1, w-border-1):
          if building[y][x] == WALL and building[y+1][x] in (EMPTY, DOOR):
              candidates.append((y,x))
  y = h - border
  if y < h:
      for x in range(border+1, w-border-1):
          if building[y][x] == WALL and building[y-1][x] in (EMPTY, DOOR):
              candidates.append((y,x))
  x = border - 1
  if x >= 0:
      for y in range(border+1, h-border-1):
          if building[y][x] == WALL and building[y][x+1] in (EMPTY, DOOR):
              candidates.append((y,x))
  x = w - border
  if x < w:
      for y in range(border+1, h-border-1):
          if building[y][x] == WALL and building[y][x-1] in (EMPTY, DOOR):
              candidates.append((y,x))




  random.shuffle(candidates)
  for (y,x) in candidates[:4*per_side]:
      building[y][x] = WIN




def place_gems(building, count=12, region=None):
  h, w = len(building), len(building[0])
  if region is None:
      empties = [(y,x) for y in range(BORDER, h-BORDER) for x in range(BORDER, w-BORDER) if building[y][x] == EMPTY]
  else:
      empties = [(y,x) for (y,x) in region if building[y][x] == EMPTY]
  random.shuffle(empties)
  for (y,x) in empties[:count]:
      building[y][x] = GEM




def place_potions(building, count=6, region=None):
  h, w = len(building), len(building[0])
  if region is None:
      empties = [(y,x) for y in range(BORDER, h-BORDER) for x in range(BORDER, w-BORDER) if building[y][x] == EMPTY]
  else:
      empties = [(y,x) for (y,x) in region if building[y][x] == EMPTY]
  random.shuffle(empties)
  for (y,x) in empties[:count]:
      building[y][x] = POTION_GROUND




def place_up_stair(building):
  h, w = len(building), len(building[0])
  empties = [(y,x) for y in range(BORDER, h-BORDER) for x in range(BORDER, w-BORDER) if building[y][x] == EMPTY]
  if not empties:
      return None
  pos = random.choice(empties)
  building[pos[0]][pos[1]] = STAIR_UP
  return pos




def place_elevators(building, count=3):
  h, w = len(building), len(building[0])
  def walkable(y,x):
      return is_walkable(building[y][x])
  candidates = []
  for y in range(BORDER+1, h-BORDER-1):
      for x in range(BORDER+1, w-BORDER-1):
          if building[y][x] != WALL:
              continue
          walk_n = 0
          wall_n = 0
          for ny,nx in neighbors4(y,x):
              if walkable(ny,nx): walk_n += 1
              if building[ny][nx] == WALL: wall_n += 1
          if walk_n >= 1 and wall_n >= 1:
              candidates.append((y,x))




  random.shuffle(candidates)
  placed = []
  for (y,x) in candidates:
      if len(placed) >= count:
          break
      if any(abs(y-py)+abs(x-px) < 6 for (py,px,_) in placed):
          continue
      kind = ELEV_OK if random.random() < 0.25 else ELEV_BROKE
      building[y][x] = kind
      placed.append((y,x,kind))
  return placed




def get_positions(grid, ch):
  res = []
  for y, row in enumerate(grid):
      for x, c in enumerate(row):
          if c == ch:
              res.append((y,x))
  return res




# =========================
# LOS / FOV / Lines
# =========================
DIRS = {"U": (-1,0), "D": (1,0), "L": (0,-1), "R": (0,1)}




def bresenham_line(a, b):
  y0, x0 = a
  y1, x1 = b
  points = []
  dx = abs(x1 - x0)
  dy = -abs(y1 - y0)
  sx = 1 if x0 < x1 else -1
  sy = 1 if y0 < y1 else -1
  err = dx + dy
  x, y = x0, y0
  while True:
      points.append((y, x))
      if x == x1 and y == y1:
          break
      e2 = 2 * err
      if e2 >= dy:
          err += dy
          x += sx
      if e2 <= dx:
          err += dx
          y += sy
  return points




def has_los(grid, a, b):
  for (y,x) in bresenham_line(a, b)[1:-1]:
      if grid[y][x] in (WALL, FURN):
          return False
  return True




def compute_fov(grid, origin, radius):
  h = len(grid); w = len(grid[0])
  oy, ox = origin
  visible = set()
  r2 = radius * radius
  y0 = max(0, oy - radius)
  y1 = min(h-1, oy + radius)
  x0 = max(0, ox - radius)
  x1 = min(w-1, ox + radius)
  for y in range(y0, y1+1):
      for x in range(x0, x1+1):
          dy = y - oy
          dx = x - ox
          if dy*dy + dx*dx > r2:
              continue
          if has_los(grid, (oy,ox), (y,x)):
              visible.add((y,x))
  visible.add((oy,ox))
  return visible




def compute_attack_line(grid, player_pos, facing, rng):
  h = len(grid); w = len(grid[0])
  dy, dx = DIRS[facing]
  y, x = player_pos
  tiles = []
  for i in range(1, rng+1):
      ny, nx = y + dy*i, x + dx*i
      if not in_bounds(h,w,ny,nx):
          break
      tiles.append((ny,nx))
      if grid[ny][nx] == WALL:
          break
  return tiles




# =========================
# FX / Particles
# =========================
class Particle:
  def __init__(self, wx, wy, kind="debris"):
      self.wx = wx + 0.5
      self.wy = wy + 0.5
      ang = random.random() * math.tau
      spd = random.uniform(2.5, 7.2) if kind=="debris" else random.uniform(4.0, 10.0)
      self.vx = math.cos(ang) * spd
      self.vy = math.sin(ang) * spd
      self.life = random.randint(260, 520) if kind=="debris" else random.randint(180, 340)
      self.max_life = self.life
      self.size = random.randint(3, 7) if kind=="debris" else random.randint(2, 5)
      self.kind = kind




  def update(self, dt):
      self.life -= dt
      self.wx += self.vx * (dt/1000.0)
      self.wy += self.vy * (dt/1000.0)
      self.vx *= (0.84 ** (dt/16.0))
      self.vy *= (0.84 ** (dt/16.0))




  def alive(self):
      return self.life > 0




def spawn_break_fx(particles, x, y, amount=26, kind="debris"):
  for _ in range(amount):
      particles.append(Particle(x, y, kind=kind))






# dict -> Item 객체 변환 (팩토리)
_ITEM_CLASSES = {
   ITEM_POTION: PotionItem,
   ITEM_CHEAP:  CheapPotionItem,
   ITEM_AMULET: AmuletItem,
   ITEM_TICKET: TicketItem,
   ITEM_WEAPON: WeaponItem,
}






PRICE = {
  ITEM_POTION: 4,
  ITEM_MAXHP_PCT: 9,
  "AXE": 11, "SPEAR": 11, "SWORD": 11, "SHIELD": 11, "HAMMER": 13,
  ITEM_PET: 24,
  ITEM_AMULET: 18,
  ITEM_TICKET: 20
}




def shield_block_chance(level):
  return min(0.45, 0.18 + 0.025 * level)




def shield_full_null_chance(level):
  return min(0.18, 0.04 + 0.015 * level)




def weapon_stats(wtype, level):
   base = WEAPONS[wtype]


   # ✅ 쿨타임 계산: dmg_equiv(=데미지)랑 분리
   cool0 = base["base_cool_ms"] * (base["cool_scale"] ** level)
   cool = int(max(420, cool0))


   rng = base["range"] + (level // 3)


   # ✅ 이제 dmg_equiv를 "실제 데미지"로 사용 (레벨로 증가 X)
   dmg = float(base["dmg_equiv"])


   return {
       "cool_ms": cool,
       "range": rng,
       "name": base["name"],
       "break_furn": base["break_furn"],
       "dmg": dmg,
       "level": level,
       "wtype": wtype
   }


def barehand_stats(max_hp):
   cool = int(max(250, 700 - max_hp * 20))
   return {"cool_ms": cool, "range": 1, "name":"Barehands", "break_furn":False, "level":0, "wtype":None, "dmg": 0.5}






class Player:
  def __init__(self, pos):
      self.pos = pos
      self.facing = "D"




      self.xp = 0
      self.maxhp_bonus_pct = 0.0




      self.hp = BASE_HP_START
      self.base_max_hp = BASE_HP_START
      self.max_hp = BASE_HP_START




      self.gems = 0
      self.score = 0




      self.inv = [None] * 7
      self.equipped_idx = None




      self.pet_count = 0
      self.pet_cd_ms = 0
      self.pet_laser_ms = 0
      self.pet_laser_from = None
      self.pet_laser_to = None




      self.hit_flash_ms = 0
      self.shake_ms = 0
      self.shake_pow = 0




      self.spear_dash_used = False
      self.is_dashing = False
      self.dash_iframes_ms = 0




      self.hurt_iframes_ms = 0




  def recompute_base_max_hp(self):
      self.base_max_hp = min(BASE_HP_CAP, BASE_HP_START + (self.xp // XP_PER_BASE_HP))




  def recompute_max_hp(self):
      self.recompute_base_max_hp()
      new_max = int(math.ceil(self.base_max_hp * (1.0 + self.maxhp_bonus_pct)))
      new_max = max(1, new_max)
      delta = new_max - self.max_hp
      if delta > 0:
          self.hp = min(new_max, self.hp + delta)
      self.max_hp = new_max




  def gain_xp(self, amount):
      prev_base = self.base_max_hp
      self.xp += max(0, amount)
      self.recompute_max_hp()
      if self.base_max_hp > prev_base:
          return f"LEVEL UP! Base MaxHP {prev_base}->{self.base_max_hp}"
      return ""




  def has_free_slot(self):
      return any(s is None for s in self.inv)


  def try_add_item_to_slot(self, item):
      for i in range(len(self.inv)):
          if self.inv[i] is None:
              self.inv[i] = item
              return True
      return False


  def current_weapon_stats(self):
      it = self.current_weapon_item()
      if not it:
          return barehand_stats(self.max_hp)
      return weapon_stats(it.wtype, it.level)


  def current_weapon_item(self):
      if self.equipped_idx is None:
          return None
      it = self.inv[self.equipped_idx]
      return it if isinstance(it, WeaponItem) else None


  def equip_weapon_slot(self, idx):
      if idx < 0 or idx >= len(self.inv):
          return "Invalid slot."
      it = self.inv[idx]
      if not isinstance(it, WeaponItem):
          self.equipped_idx = None
          return "No weapon there (Barehands)."
      self.equipped_idx = idx
      st = self.current_weapon_stats()
      return f"Equipped {st['name']} Lv{st['level']}."


  def remove_item_from_slot(self, idx):
      if idx < 0 or idx >= len(self.inv):
          return None
      it = self.inv[idx]
      self.inv[idx] = None
      if self.equipped_idx == idx:
          self.equipped_idx = None
      return it


  def use_ticket(self):
      weapons = [(i, it) for i, it in enumerate(self.inv) if isinstance(it, WeaponItem)]
      if not weapons:
          self.maxhp_bonus_pct += MAXHP_PCT_STEP
          self.recompute_max_hp()
          return "Ticket: no weapon -> MaxHP% +10%!"
      i, it = random.choice(weapons)
      if it.level <= 3:
          it.level = 4
          it.NAME = f"{WEAPONS[it.wtype]['name']} Lv{it.level}"
          return f"Ticket: {WEAPONS[it.wtype]['name']} upgraded to Lv4!"
      return "Ticket: nothing happened (weapon already high)."


  def use_slot(self, idx):
      if idx < 0 or idx >= len(self.inv):
          return ""
      item = self.inv[idx]
      if item is None:
          return "Empty slot."
      return item.on_use(self, idx)




# =========================
# Monsters
# =========================
KIND_MELEE  = "MELEE"
KIND_SNIPER = "SNIPER"
KIND_DIGGER = "DIGGER"
KIND_WITCH  = "WITCH"




class Monster:
  def __init__(self, pos, kind, floor):
      self.pos = pos
      self.kind = kind
      self.shoot_cd_ms = 0
      self.dig_cd_ms = 0
      self.move_accum = 0


      # ✅ 몬스터 HP를 float로
      self.hp = float(MONSTER_BASE_HP)


      self.slow_ms = 0
      if kind == KIND_SNIPER:
          self.base_dmg = float(1 + (floor - 1) // 7)
      else:
          self.base_dmg = float(1 + (floor - 1) // 3)


      self.last_broke = None
      # WITCH 전용: 플레이어 시야 누적(LOS+visible 기준)
      self.see_ms = 0
      self.blink_ms = 0








  def tick_mult(self):
      return ANGEL_SLOW_MULT if self.slow_ms > 0 else 1.0


  def can_see_player(self, grid, player_pos, visible_set):
      # "본 시간" 정의: 본인도 visible에 있고 + LOS가 이어짐
      if self.pos not in visible_set:
          return False
      if not has_los(grid, self.pos, player_pos):
          return False
      return True




  def preferred_dirs(self, y,x,ty,tx):
      dy = ty - y
      dx = tx - x
      dirs = []
      if abs(dx) >= abs(dy):
          dirs.append((0, 1 if dx>0 else -1 if dx<0 else 0))
          dirs.append((1 if dy>0 else -1 if dy<0 else 0, 0))
      else:
          dirs.append((1 if dy>0 else -1 if dy<0 else 0, 0))
          dirs.append((0, 1 if dx>0 else -1 if dx<0 else 0))
      dirs += [(1,0),(-1,0),(0,1),(0,-1)]
      out=[]
      for a,b in dirs:
          if a==0 and b==0: continue
          if (a,b) not in out: out.append((a,b))
      return out




  def digger_step(self, grid, target, blocked):
      h = len(grid); w = len(grid[0])
      y, x = self.pos
      ty, tx = target
      self.last_broke = None




      if self.dig_cd_ms > 0:
          for dy,dx in self.preferred_dirs(y,x,ty,tx):
              ny, nx = y+dy, x+dx
              if not in_bounds(h,w,ny,nx): continue
              if not in_inner(h,w,ny,nx,BORDER): continue
              if (ny,nx) in blocked: continue
              if grid[ny][nx] not in (WALL, FURN) and is_walkable(grid[ny][nx]):
                  return (ny,nx)
          return (y,x)




      for dy,dx in self.preferred_dirs(y,x,ty,tx):
          ny, nx = y+dy, x+dx
          if not in_bounds(h,w,ny,nx): continue
          if not in_inner(h,w,ny,nx,BORDER): continue
          if (ny,nx) in blocked: continue




          if grid[ny][nx] == WALL:
              grid[ny][nx] = EMPTY
              self.dig_cd_ms = 220
              self.last_broke = (ny, nx)
              return (ny,nx)




          if grid[ny][nx] == FURN:
              continue




          if is_walkable(grid[ny][nx]):
              return (ny,nx)




      return (y,x)




  def step_toward(self, grid, target, blocked):
      if self.kind == KIND_DIGGER:
          return self.digger_step(grid, target, blocked)




      if self.pos == target:
          return self.pos
      h = len(grid); w = len(grid[0])
      q = deque([self.pos])
      prev = {self.pos: None}
      while q:
          y,x = q.popleft()
          for ny,nx in neighbors4(y,x):
              if not in_bounds(h,w,ny,nx): continue
              if (ny,nx) in prev: continue
              if (ny,nx) in blocked: continue
              if not (is_walkable(grid[ny][nx]) and grid[ny][nx] not in (WALL, FURN)):
                  continue
              prev[(ny,nx)] = (y,x)
              if (ny,nx) == target:
                  q.clear()
                  break
              q.append((ny,nx))
      if target not in prev:
          return self.pos
      cur = target
      while prev[cur] is not None and prev[cur] != self.pos:
          cur = prev[cur]
      return cur if prev[cur] == self.pos else self.pos


  def can_shoot(self, grid, player_pos, visible_set):
      if self.kind not in (KIND_SNIPER, KIND_WITCH):
          return False
      if self.pos not in visible_set:
          return False


      sy, sx = self.pos
      py, px = player_pos
      dist = abs(py - sy) + abs(px - sx)


      # 사거리: 스나이퍼 그대로, 위치도 동일
      if dist > 9:
          return False
      if not has_los(grid, self.pos, player_pos):
          return False
      return True




# =========================
# Boss
# =========================
class Boss:
  def __init__(self, center, hp=96):
      self.center = center
      self.max_hp = float(hp)
      self.hp = float(hp)
      self.phase = "IDLE"
      self.timer = 0
      self.dash_dir = (0,0)
      self.dash_steps_left = 0
      self.blink_toggle = False




      self.summon_66 = False
      self.summon_33 = False




      self.touch_dmg = 2
      self.leg_anim_t = 0
      self.leg_flip = False




  def blocks_for_center(self, c):
      cy,cx = c
      return {(cy,cx),(cy-1,cx-1),(cy-1,cx+1),(cy+1,cx-1),(cy+1,cx+1)}




  def blocks(self):
      return self.blocks_for_center(self.center)




  def is_colliding(self, pos):
      return pos in self.blocks()




  def pick_dash_dir(self, player_pos):
      cy,cx = self.center
      py,px = player_pos
      dy = py - cy
      dx = px - cx
      if abs(dx) >= abs(dy):
          return (0, 1 if dx>0 else -1)
      else:
          return (1 if dy>0 else -1, 0)




  def dash_interval_ms(self):
      missing = max(0, self.max_hp - self.hp)
      r = missing / max(1, self.max_hp)
      return int(1300 - 880 * (r ** 0.85))




  def can_move_center(self, grid, new_center):
      blocks = self.blocks_for_center(new_center)
      for (y,x) in blocks:
          if not in_inner(len(grid), len(grid[0]), y, x, BORDER):
              return False
          if grid[y][x] == WALL:
              return False
      return True




  def update(self, dt, grid, player_pos):
      broken = []
      self.timer += dt
      self.leg_anim_t += dt
      if self.leg_anim_t >= 160:
          self.leg_anim_t = 0
          self.leg_flip = not self.leg_flip




      if self.phase == "IDLE":
          if self.timer > self.dash_interval_ms():
              self.phase = "BLINK"
              self.timer = 0
              self.blink_toggle = False
              self.dash_dir = self.pick_dash_dir(player_pos)
              self._blink_count = 0




      elif self.phase == "BLINK":
          if self.timer > 90:
              self.blink_toggle = not self.blink_toggle
              self.timer = 0
              self._blink_count += 1
              if self._blink_count >= 5:
                  self.phase = "DASH"
                  self.timer = 0
                  self.dash_steps_left = 14
                  self.dash_dir = self.pick_dash_dir(player_pos)




      elif self.phase == "DASH":
          step_every = 26
          h=len(grid); w=len(grid[0])
          while self.timer >= step_every and self.dash_steps_left > 0:
              self.timer -= step_every
              self.dash_steps_left -= 1
              dy,dx = self.dash_dir
              ny = self.center[0] + dy
              nx = self.center[1] + dx




              if not in_bounds(h,w,ny,nx):
                  self.dash_steps_left = 0
                  break




              if not self.can_move_center(grid, (ny,nx)):
                  self.dash_steps_left = 0
                  break




              self.center = (ny,nx)




              for (by,bx) in self.blocks():
                  c = grid[by][bx]
                  if c in (WALL, FURN, GEM, POTION_GROUND, AMULET_GROUND, WEAPON_GROUND, TICKET_GROUND):
                      grid[by][bx] = EMPTY
                      broken.append((by,bx,c))




          if self.dash_steps_left <= 0:
              self.phase = "RECOVER"
              self.timer = 0




      elif self.phase == "RECOVER":
          if self.timer > 520:
              self.phase = "IDLE"
              self.timer = 0




      return broken




# =========================
# Spawns / treasure
# =========================
def place_monsters_with_types(building, floor, avoid_pos=None, avoid_dist=6, min_gap=3):
   """
   - building의 EMPTY에 몬스터 배치(MON 문자)
   - min_gap: 몬스터끼리 최소 맨해튼 거리
   - avoid_pos/avoid_dist: (y,x) 기준 반경(맨해튼) 안에는 스폰 안 하게
   """
   h, w = len(building), len(building[0])


   cfg = theme_cfg(floor)
   theme = get_theme_for_floor(floor)


   # 후보: "완전 EMPTY"만 (스폰은 무조건 빈바닥에만!)
   empties = [(y, x) for y in range(BORDER, h - BORDER)
                     for x in range(BORDER, w - BORDER)
                     if building[y][x] == EMPTY]


   # 시작 위치 근처 피하기(옵션)
   if avoid_pos is not None:
       ay, ax = avoid_pos
       empties = [(y, x) for (y, x) in empties if abs(y - ay) + abs(x - ax) >= avoid_dist]


   random.shuffle(empties)


   # cap
   cap = min(12, 4 + (floor // 2))


   # sniper 확률
   base_sniper = 0.12 if floor == 1 else 0.33
   p_sniper = min(0.70, base_sniper + cfg["sniper_bias"])


   # digger 확률 (노말에서만)
   if theme == THEME_NORMAL and floor >= 3:
       p_digger = min(0.40, 0.10 + 0.03 * (floor - 3) + cfg["digger_bonus"])
   else:
       p_digger = 0.0


   # WITCH 확률(11층~)
   if floor >= 11:
       p_witch = min(0.22, 0.06 + 0.01 * (floor - 11))
   else:
       p_witch = 0.0


   spawned = []          # [(((y,x), kind), ...)] 형태로 반환
   placed_positions = [] # 몬스터끼리 간격 체크용


   def ok_gap(y, x):
       for (py, px) in placed_positions:
           if abs(y - py) + abs(x - px) < min_gap:
               return False
       return True


   for (y, x) in empties:
       if len(spawned) >= cap:
           break
       if not ok_gap(y, x):
           continue


       r = random.random()
       if r < p_witch:
           kind = KIND_WITCH
       elif r < (p_witch + p_digger):
           kind = KIND_DIGGER
       else:
           kind = KIND_SNIPER if (random.random() < p_sniper) else KIND_MELEE


       # ✅ 핵심 1: 그리드에 몬스터 문자 찍기
       building[y][x] = MON
       # ✅ 핵심 2: spawned에 기록 남기기
       spawned.append(((y, x), kind))
       placed_positions.append((y, x))


   return spawned






def treasure_room_from_rooms(rooms):
  if not rooms:
      return None
  rx, ry, rw, rh = random.choice(rooms)
  cells = set()
  for y in range(ry+1, ry+rh-1):
      for x in range(rx+1, rx+rw-1):
          cells.add((y,x))
  return cells




def build_floor_tutorial(w=40, h=22):
  grid = [[WALL for _ in range(w)] for _ in range(h)]
  for y in range(1, h-1):
      for x in range(1, w-1):
          grid[y][x] = EMPTY
  for x in range(10, 16):
      grid[8][x] = WALL
  for y in range(12, 15):
      grid[y][22] = WALL
  grid[14][23] = FURN
  grid[14][24] = FURN
  grid[6][30] = GEM
  grid[7][30] = POTION_GROUND
  grid[h-3][w-3] = TUTOR_EXIT
  grid[4][4] = STAIR_UP
  return grid




def build_floor_boss(w=45, h=27):
  grid = [[WALL for _ in range(w)] for _ in range(h)]
  for y in range(2, h-2):
      for x in range(2, w-2):
          grid[y][x] = EMPTY
  for y in range(1, h-1):
      grid[y][1] = WALL
      grid[y][w-2] = WALL
  for x in range(1, w-1):
      grid[1][x] = WALL
      grid[h-2][x] = WALL




  for _ in range(10):
      y = random.randint(2, h-3)
      x = random.randint(2, w-3)
      grid[y][x] = GEM if random.random() < 0.7 else POTION_GROUND
  return grid




def build_floor_normal(floor, luck):
   cfg = theme_cfg(floor)
   w = cfg["w"]; h = cfg["h"]


   grid, rooms = generate_building(
       width=w, height=h,
       corridor_spacing=cfg["corridor_spacing"],
       corridor_width=cfg["corridor_width"],
       room_count=cfg["room_count"],
       seed=None, border=BORDER
   )


   place_up_stair(grid)


   # 어둠층: 엘베를 줄이거나 없애도 됨. (원하면 유지)
   elev_count = 3 if get_theme_for_floor(floor) == THEME_NORMAL else 2
   place_elevators(grid, count=elev_count)


   treasure_cells = set()
   if rooms and (random.random() < 0.50):
       treasure_cells = treasure_room_from_rooms(rooms) or set()
       place_gems(grid, count=10 + floor*2, region=treasure_cells)
       place_potions(grid, count=6 + floor//2, region=treasure_cells)


       if treasure_cells and (random.random() < (0.004 + luck*0.006)):
           empties = [c for c in treasure_cells if grid[c[0]][c[1]] == EMPTY]
           if empties:
               y,x = random.choice(empties)
               grid[y][x] = TICKET_GROUND


   # 기본 보상: 테마별 base를 적용
   place_gems(grid, count=cfg["gem_base"] + floor*2)
   place_potions(grid, count=cfg["potion_base"] + floor//2)


   # 가구/창문도 테마 반영
   place_furniture_safe(grid, density=cfg["furn_density"], max_trials=11000)
   place_windows(grid, per_side=cfg["windows_per_side"])


   spawned = place_monsters_with_types(grid, floor, avoid_pos=None)  # or 플레이어 스폰 후보 넣을 거면 여기서


   return grid, spawned, treasure_cells






def spawn_monsters_from_grid(grid, spawned, floor):
  mpos = get_positions(grid, MON)
  for y,x in mpos:
      grid[y][x] = EMPTY
  kind_map = {pos: kind for (pos, kind) in spawned}
  return [Monster((y,x), kind_map.get((y,x), KIND_MELEE), floor) for (y,x) in mpos]




# =========================
# Safe spawn (anti spawn-kill)
# =========================
def walkable_empty_cells(grid):
   h=len(grid); w=len(grid[0])
   cells=[]
   for y in range(BORDER, h-BORDER):
       for x in range(BORDER, w-BORDER):
           if grid[y][x] == EMPTY:   # ✅ 스폰은 무조건 빈칸만
               cells.append((y,x))
   return cells




def manhattan(a,b):
  return abs(a[0]-b[0]) + abs(a[1]-b[1])




def ensure_safe_spawn(grid, monsters, prefer=None, min_dist=4):
   empties = walkable_empty_cells(grid)
   random.shuffle(empties)


   if not empties:
       # 맵이 진짜 이상한 경우 안전장치
       return (BORDER, BORDER), monsters


   def safe(p):
       return all(manhattan(p, m.pos) >= min_dist for m in monsters)


   # ✅ prefer가 진짜 스폰 가능한 칸인지 검사 (안 하면 벽끼임 터짐)
   if prefer is not None:
       if prefer not in empties:
           prefer = None


   if prefer and safe(prefer):
       return prefer, monsters


   for p in empties:
       if safe(p):
           return p, monsters


   # safe 스폰이 아예 없으면: prefer(없으면 empties[0])를 쓰고 몹을 멀리 재배치
   p = prefer if prefer else empties[0]


   far_cells = [c for c in empties if manhattan(c, p) >= min_dist]
   random.shuffle(far_cells)


   used = {m.pos for m in monsters}
   new_monsters = []
   for m in monsters:
       if manhattan(m.pos, p) < min_dist:
           placed = False
           for c in far_cells:
               if c not in used:
                   used.add(c)
                   m.pos = c
                   placed = True
                   break
           if not placed:
               continue
       new_monsters.append(m)


   return p, new_monsters




# =========================
# Pet behavior
# =========================
def pet_attack(player, monsters, boss, visible, dt, particles, grid, score_add_fn):
  if player.pet_count <= 0:
      return monsters, ""




  base_cd = ANGEL_TWO_FIRE_MS if player.pet_count >= 2 else ANGEL_BASE_FIRE_MS
  player.pet_cd_ms = max(0, player.pet_cd_ms - dt)
  if player.pet_cd_ms > 0:
      return monsters, ""




  py, px = player.pos
  cand_mon = []
  for m in monsters:
      if m.pos not in visible:
          continue
      my, mx = m.pos
      if abs(my-py) + abs(mx-px) <= ANGEL_MISSILE_RANGE and has_los(grid, player.pos, m.pos):
          cand_mon.append(m)




  boss_candidate = False
  if boss is not None:
      if any(b in visible for b in boss.blocks()):
          cy,cx = boss.center
          if abs(cy-py) + abs(cx-px) <= ANGEL_MISSILE_RANGE and has_los(grid, player.pos, boss.center):
              boss_candidate = True




  if not cand_mon and not boss_candidate:
      return monsters, ""




  target_is_boss = False
  if boss_candidate and (not cand_mon or random.random() < 0.35):
      target_is_boss = True
  else:
      target = min(cand_mon, key=lambda m: abs(m.pos[0]-py) + abs(m.pos[1]-px))




  player.pet_laser_ms = 140
  player.pet_laser_from = (py, px)
  player.pet_laser_to = boss.center if target_is_boss else target.pos




  tx, ty = (boss.center[1], boss.center[0]) if target_is_boss else (target.pos[1], target.pos[0])
  spawn_break_fx(particles, tx, ty, amount=18 + 8*min(4, player.pet_count), kind="spark")




  if target_is_boss:
      boss.hp -= ANGEL_MISSILE_DAMAGE
      score_add_fn(SCORE_BOSS_HIT)
      msg = "Angel hits BOSS!"
  else:
      target.hp -= ANGEL_MISSILE_DAMAGE
      target.slow_ms = max(target.slow_ms, ANGEL_SLOW_MS)
      msg = "Angel missile! (slow)"
      if target.hp <= 0:
          spawn_break_fx(particles, target.pos[1], target.pos[0], amount=28, kind="spark")
          monsters = [m for m in monsters if m is not target]
          score_add_fn(SCORE_KILL_ANGEL)
          player.gain_xp(XP_KILL)
          msg = "Angel missile! (kill)"




  player.pet_cd_ms = base_cd
  return monsters, msg




# =========================
# Amulet blast
# =========================
def amulet_blast(grid, player_pos, monsters, boss, particles, ground_weapons, ground_tickets, radius=7):
  h = len(grid); w = len(grid[0])
  py, px = player_pos




  removed_mon = removed_item = removed_wall = removed_furn = 0




  keep = []
  for m in monsters:
      my, mx = m.pos
      if (my-py)**2 + (mx-px)**2 <= radius*radius:
          removed_mon += 1
          spawn_break_fx(particles, mx, my, amount=24, kind="spark")
      else:
          keep.append(m)
  monsters = keep




  for y in range(max(0, py-radius), min(h, py+radius+1)):
      for x in range(max(0, px-radius), min(w, px+radius+1)):
          if (y-py)**2 + (x-px)**2 > radius*radius:
              continue
          c = grid[y][x]
          if c in (STAIR_UP, ELEV_OK, ELEV_BROKE, DOOR, WIN, TUTOR_EXIT):
              continue




          if c == WALL:
              grid[y][x] = EMPTY
              removed_wall += 1
              spawn_break_fx(particles, x, y, amount=18, kind="debris")
          elif c == FURN:
              grid[y][x] = EMPTY
              removed_furn += 1
              spawn_break_fx(particles, x, y, amount=22, kind="debris")
          elif c in (GEM, POTION_GROUND, AMULET_GROUND, WEAPON_GROUND, TICKET_GROUND):
              grid[y][x] = EMPTY
              removed_item += 1
              spawn_break_fx(particles, x, y, amount=14, kind="spark")
              if c == WEAPON_GROUND and (y,x) in ground_weapons:
                  ground_weapons.pop((y,x), None)
              if c == TICKET_GROUND and (y,x) in ground_tickets:
                  ground_tickets.pop((y,x), None)




  if boss is not None:
      cy,cx = boss.center
      if (cy-py)**2 + (cx-px)**2 <= radius*radius:
          boss.hp -= 24 #아뮬렛 대미지


          spawn_break_fx(particles, cx, cy, amount=48, kind="spark")




  return monsters, (removed_wall, removed_furn, removed_item, removed_mon)




# =========================
# Damage helper + knockback
# =========================
def try_knockback_1(grid, player_pos, source_pos):
  py, px = player_pos
  sy, sx = source_pos
  dy = py - sy
  dx = px - sx
  if dy == 0 and dx == 0:
      # if same tile, do NOT knock in random direction -> just no knockback
      return (py,px)
  if abs(dx) >= abs(dy):
      step = (0, 1 if dx>0 else -1)
  else:
      step = (1 if dy>0 else -1, 0)
  ny, nx = py + step[0], px + step[1]
  if in_bounds(len(grid), len(grid[0]), ny, nx) and is_walkable(grid[ny][nx]) and grid[ny][nx] not in (WALL, FURN):
      return (ny,nx)
  return (py,px)




def apply_damage(player, raw_dmg, particles, msg_prefix="", use_iframes=True):
  if player.dash_iframes_ms > 0:
      return False, f"{msg_prefix}Invulnerable!"
  if use_iframes and player.hurt_iframes_ms > 0:
      return False, f"{msg_prefix}I-frames!"




  dmg = raw_dmg
  w = player.current_weapon_item()
  if isinstance(w, WeaponItem) and w.wtype == "SHIELD":
      lv = w.level
      if random.random() < shield_full_null_chance(lv):
          spawn_break_fx(particles, player.pos[1], player.pos[0], amount=16, kind="spark")
          return False, f"{msg_prefix}Shield NULL!"
      if random.random() < shield_block_chance(lv):
          dmg = max(0, dmg - 1)
          spawn_break_fx(particles, player.pos[1], player.pos[0], amount=12, kind="spark")




  if dmg <= 0:
      return False, f"{msg_prefix}Blocked!"




  new_hp = player.hp - dmg
  if new_hp <= 0 and player.pet_count > 0:
      player.pet_count -= 1
      player.hp = 1
      player.shake_ms = HIT_SHAKE_MS
      player.shake_pow = 10
      player.hit_flash_ms = HIT_FLASH_MS
      player.hurt_iframes_ms = PLAYER_HURT_IFRAMES_MS
      spawn_break_fx(particles, player.pos[1], player.pos[0], amount=40, kind="spark")
      return False, f"{msg_prefix}Guardian Angel! (x{player.pet_count}) -> 1 HP"
  else:
      player.hp = new_hp
      player.shake_ms = HIT_SHAKE_MS
      player.shake_pow = 8
      player.hit_flash_ms = HIT_FLASH_MS
      player.hurt_iframes_ms = PLAYER_HURT_IFRAMES_MS
      return (player.hp <= 0), f"{msg_prefix}-HP ({dmg})"




# =========================
# Shop (fixed per floor)
# =========================
def inv_weapon_types(player):
   types = []
   for it in player.inv:
       if isinstance(it, WeaponItem):
           types.append(it.wtype)
   return types






def player_has_weapon_type(player, wtype):
   return any(isinstance(it, WeaponItem) and it.wtype == wtype for it in player.inv)






def upgrade_weapon_in_inventory(player, wtype):
   idx_best = None
   best_lv = -1
   for i, it in enumerate(player.inv):
       if isinstance(it, WeaponItem) and it.wtype == wtype:
           if it.level > best_lv:
               best_lv = it.level
               idx_best = i


   if idx_best is not None:
       player.inv[idx_best].level += 1
       player.inv[idx_best].NAME = f"{WEAPONS[wtype]['name']} Lv{player.inv[idx_best].level}"
       return True, f"Upgraded {WEAPONS[wtype]['name']} to Lv{player.inv[idx_best].level}."
   else:
       if not player.has_free_slot():
           return False, "Inventory full (weapon)."
       player.try_add_item_to_slot(WeaponItem(wtype, level=1))
       return True, f"Bought {WEAPONS[wtype]['name']} Lv1."






def pick_shop_offers3(player, floor, luck):
  pool = []
  pool += [{"type": ITEM_POTION}] * 9




  if floor == 4:
      pool += [{"type": ITEM_TICKET}] * 50
  else:
      if random.random() < (0.01 + luck*0.01):
          pool += [{"type": ITEM_TICKET}] * 3




  if random.random() < (0.05 + luck*0.04):
      pool += [{"type": ITEM_AMULET}] * 2




  owned = inv_weapon_types(player)
  for w in WEAPONS.keys():
      weight = 1
      if w in owned:
          weight += 2
      pool += [{"type": ITEM_WEAPON, "wtype": w}] * weight




  if (player.pet_count < 4) and (random.random() < (luck * 0.9)):
      pool += [{"type": ITEM_PET}] * 2




  if len(pool) < 3:
      pool += [{"type": ITEM_POTION}] * 3




  offers = random.sample(pool, 3)
  offers.append({"type": ITEM_MAXHP_PCT})
  return offers




def offer_needs_inventory_slot(player, offer):
  t = offer["type"]
  if t in (ITEM_POTION, ITEM_AMULET, ITEM_TICKET):
      return True
  if t == ITEM_WEAPON:
      return not player_has_weapon_type(player, offer["wtype"])
  return False




def buy_offer(player, offer):
   if offer is None:
       return False, "Sold out."


   if offer_needs_inventory_slot(player, offer) and (not player.has_free_slot()):
       return False, "Inventory full. Can't buy."


   t = offer["type"]


   if t == ITEM_POTION:
       cost = PRICE[ITEM_POTION]
       if player.gems < cost: return False, "Not enough gems."
       if not player.try_add_item_to_slot(PotionItem()): return False, "Inventory full."
       player.gems -= cost
       return True, "Bought potion."


   if t == ITEM_MAXHP_PCT:
       cost = PRICE[ITEM_MAXHP_PCT]
       if player.gems < cost: return False, "Not enough gems."
       player.gems -= cost
       player.maxhp_bonus_pct += MAXHP_PCT_STEP
       player.recompute_max_hp()
       return True, f"MaxHP bonus +{int(MAXHP_PCT_STEP*100)}%."


   if t == ITEM_AMULET:
       cost = PRICE[ITEM_AMULET]
       if player.gems < cost: return False, "Not enough gems."
       if not player.try_add_item_to_slot(AmuletItem()): return False, "Inventory full."
       player.gems -= cost
       return True, "Bought Amulet."


   if t == ITEM_TICKET:
       cost = PRICE[ITEM_TICKET]
       if player.gems < cost: return False, "Not enough gems."
       if not player.try_add_item_to_slot(TicketItem()): return False, "Inventory full."
       player.gems -= cost
       return True, "Bought Ticket."


   if t == ITEM_PET:
       cost = PRICE[ITEM_PET]
       if player.gems < cost: return False, "Not enough gems."
       player.gems -= cost
       player.pet_count = min(4, player.pet_count + 1)
       return True, f"Angel joined you! (x{player.pet_count})"


   if t == ITEM_WEAPON:
       wtype = offer["wtype"]
       cost = PRICE[wtype]
       if player.gems < cost: return False, "Not enough gems."
       player.gems -= cost
       ok, sm = upgrade_weapon_in_inventory(player, wtype)
       if ok and player.equipped_idx is None:
           for i, it in enumerate(player.inv):
               if isinstance(it, WeaponItem):
                   player.equipped_idx = i
                   break
       return ok, sm


   return False, "Unknown offer."




# =========================
# Spear dash skill
# =========================
def spear_dash(player, grid, monsters, boss, particles,
              ground_weapons, ground_tickets, score_add_fn, treasure_cells):
   it = player.current_weapon_item()  # WeaponItem or None


   # ✅ WeaponItem은 dict가 아니라 객체라서 .wtype / .level 로 접근
   if (it is None) or (it.wtype != "SPEAR") or (it.level < 3):
       return monsters, "Need Spear Lv3 equipped."
   if player.spear_dash_used:
       return monsters, "Dash already used this floor."


   lv = it.level
   length = max(1, lv * 2)


   st = player.current_weapon_stats()
   dmg = float(st.get("dmg", 1.0))


   dy, dx = DIRS[player.facing]
   py, px = player.pos


   player.spear_dash_used = True
   player.is_dashing = True
   player.dash_iframes_ms = 520


   # dash path
   path = []
   for i in range(1, length + 1):
       ny, nx = py + dy * i, px + dx * i
       if not in_bounds(len(grid), len(grid[0]), ny, nx):
           break
       path.append((ny, nx))


   final = player.pos
   for (y, x) in path:
       c = grid[y][x]


       # break tiles (같은 로직 유지)
       if c == WALL:
           grid[y][x] = EMPTY
           spawn_break_fx(particles, x, y, amount=24, kind="debris")
           treasure_cells.discard((y, x))
       elif c == FURN:
           grid[y][x] = EMPTY
           spawn_break_fx(particles, x, y, amount=30, kind="debris")
       elif c in (GEM, POTION_GROUND, AMULET_GROUND, WEAPON_GROUND, TICKET_GROUND):
           grid[y][x] = EMPTY
           spawn_break_fx(particles, x, y, amount=18, kind="spark")
           if c == WEAPON_GROUND:
               ground_weapons.pop((y, x), None)
           if c == TICKET_GROUND:
               ground_tickets.pop((y, x), None)


       # kill monsters on path
       killed = [m for m in monsters if m.pos == (y, x)]
       if killed:
           for km in killed:
               spawn_break_fx(particles, x, y, amount=28, kind="spark")
               score_add_fn(SCORE_KILL)
               player.gain_xp(XP_KILL)
           monsters = [m for m in monsters if m.pos != (y, x)]


       # boss hit
       # ✅ boss hit (dash path tile overlaps boss blocks)
       if boss is not None and (y, x) in boss.blocks():
           boss.hp -= dmg * 10
           score_add_fn(SCORE_BOSS_HIT)
           spawn_break_fx(particles, boss.center[1], boss.center[0], amount=40, kind="spark")
           msg = f"Hit BOSS! (-{dmg*10:g})"


       # stop if still blocked (보통 위에서 WALL/FURN을 EMPTY로 바꿔서 여기 걸릴 일 거의 없음)
       if grid[y][x] in (WALL, FURN):
           break


       final = (y, x)


   player.pos = final
   return monsters, f"Spear Dash! (used) len={length}"






# =========================
# Rendering helpers
# =========================
def draw_text(screen, font, text, x, y, col=(240,240,245)):
  surf = font.render(text, True, col)
  screen.blit(surf, (x,y))
  return surf.get_width(), surf.get_height()




def draw_panel(screen, rect, fill=(18,18,26), border=(70,70,90)):
  pygame.draw.rect(screen, fill, rect, border_radius=14)
  pygame.draw.rect(screen, border, rect, 2, border_radius=14)




def get_hp_vignette_alpha(player):
  if player.max_hp <= 0:
      return 0
  missing = max(0, player.max_hp - player.hp)
  ratio = missing / player.max_hp
  return int(220 * (ratio ** 1.35))




def draw_hp_vignette(screen, alpha):
  if alpha <= 0:
      return
  W, H = screen.get_width(), screen.get_height()
  surf = pygame.Surface((W, H), pygame.SRCALPHA)
  layers = 10
  for i in range(layers):
      a = int(alpha * (i+1)/layers * 0.55)
      pad = int((i / layers) * 90)
      rect = pygame.Rect(pad, pad, W - 2*pad, H - 2*pad)
      pygame.draw.rect(surf, (255, 0, 40, min(255,a)), rect, width=18, border_radius=18)
  screen.blit(surf, (0,0))




def draw_hit_flash(screen, alpha):
  if alpha <= 0:
      return
  surf = pygame.Surface((screen.get_width(), screen.get_height()), pygame.SRCALPHA)
  surf.fill((255, 80, 80, alpha))
  screen.blit(surf, (0,0))




def draw_ui_bar(screen, font, player, floor, msg, atk_cd_ms, drop_mode, state_name, boss, player_name):
  w = screen.get_width()
  bar = pygame.Rect(0, 0, w, UI_H)
  pygame.draw.rect(screen, (18,18,26), bar)
  pygame.draw.line(screen, (70,70,90), (0, UI_H-1), (w, UI_H-1), 2)




  st = player.current_weapon_stats()
  cd = max(0, atk_cd_ms)/1000.0
  pet = f" | Angel x{player.pet_count}" if player.pet_count > 0 else ""
  dm = " | DROP MODE(G+1~7)" if drop_mode else ""




  dash = ""
  wcur = player.current_weapon_item()
  wcur = player.current_weapon_item()
  if isinstance(wcur, WeaponItem) and wcur.wtype == "SPEAR" and wcur.level >= 3:
      dash = f" | SpearDash(Shift+Space): {'USED' if player.spear_dash_used else 'READY'}"


  boss_line = ""
  if boss is not None:
      boss_line = f" | BOSS HP {int(boss.hp)}"




  draw_text(screen, font,
            f"[{state_name}] Player {player_name} | Floor {floor} | HP {int(player.hp)}/{int(player.max_hp)} (Base {int(player.base_max_hp)}, +{int(player.maxhp_bonus_pct*100)}%) | Gems {player.gems} | SCORE {player.score} | Weapon {st['name']} (DMG {st['dmg']:g} R{st['range']} CD{st['cool_ms']/1000:.2f}s) | ATK CD {cd:.2f}s{pet}{dash}{boss_line}{dm}",
            14, 10)
  draw_text(screen, font,
            "Move WASD/Arrows | Space attack | E elevator | I inventory | G drop | 1~7 use/equip/drop | ESC menu",
            14, 38, (205,205,220))
  if msg:
      draw_text(screen, font, msg, 14, 64, (255,220,140))




def draw_world(screen, grid, player, monsters, boss, visible, seen,
              view_w, view_h, ox, oy,
              ground_weapons, ground_tickets, treasure_cells, floor):
  h = len(grid); w = len(grid[0])
  cx = view_w // 2
  cy = view_h // 2




  for vy in range(view_h):
      for vx in range(view_w):
          wy = player.pos[0] + (vy - cy)
          wx = player.pos[1] + (vx - cx)
          rect = pygame.Rect(ox + vx*TILE, oy + vy*TILE, TILE, TILE)




          if not in_bounds(h, w, wy, wx):
              pygame.draw.rect(screen, (0,0,0), rect)
              continue




          if (wy,wx) not in seen:
              pygame.draw.rect(screen, (0,0,0), rect)
              continue




          c = grid[wy][wx]
          is_vis = (wy,wx) in visible


          cfg = theme_cfg(floor)


          if is_vis:
              floor_col = cfg["col_floor_vis"]
              if (wy, wx) in treasure_cells:
                  floor_col = cfg["col_treasure"]
              wall_col = cfg["col_wall_vis"]
          else:
              floor_col = cfg["col_floor_dim"]
              wall_col = cfg["col_wall_dim"]


          pygame.draw.rect(screen, floor_col, rect)
          if c == WALL:
              pygame.draw.rect(screen, wall_col, rect)




          if is_vis:
              if c == DOOR:
                  pygame.draw.rect(screen, (140,140,190), rect.inflate(-8,-8))
              elif c == FURN:
                  pygame.draw.rect(screen, (180,140,95), rect.inflate(-6,-6))
              elif c == WIN:
                  pygame.draw.rect(screen, (130,170,230), rect.inflate(-10,-10))
              elif c == STAIR_UP:
                  pygame.draw.rect(screen, (80,220,160), rect.inflate(-6,-6))
              elif c == ELEV_OK:
                  pygame.draw.rect(screen, (120,200,255), rect.inflate(-6,-6))
              elif c == ELEV_BROKE:
                  pygame.draw.rect(screen, (170,170,170), rect.inflate(-6,-6))
              elif c == GEM:
                  pygame.draw.circle(screen, (255,220,120), rect.center, TILE//4)
              elif c == POTION_GROUND:
                  pygame.draw.circle(screen, (120, 255, 170), rect.center, TILE//4)
                  pygame.draw.circle(screen, (20, 90, 50), rect.center, TILE//4, 2)
              elif c == AMULET_GROUND:
                  pygame.draw.circle(screen, (220, 210, 255), rect.center, TILE//4)
                  pygame.draw.circle(screen, (120, 70, 255), rect.center, TILE//4, 2)
              elif c == WEAPON_GROUND:
                  p1 = (rect.centerx, rect.y + 6)
                  p2 = (rect.x + 6, rect.bottom - 6)
                  p3 = (rect.right - 6, rect.bottom - 6)
                  pygame.draw.polygon(screen, (175,175,185), [p1,p2,p3])
                  pygame.draw.polygon(screen, (60,60,70), [p1,p2,p3], 2)
              elif c == TICKET_GROUND:
                  pygame.draw.circle(screen, (210, 240, 255), rect.center, TILE//4)
                  pygame.draw.circle(screen, (255, 210, 255), rect.center, TILE//4, 2)
                  pygame.draw.circle(screen, (220, 255, 210), rect.center, TILE//5, 2)
              elif c == TUTOR_EXIT:
                  pygame.draw.rect(screen, (255, 220, 120), rect.inflate(-8,-8))
                  pygame.draw.rect(screen, (90, 60, 10), rect.inflate(-8,-8), 2)




          pygame.draw.rect(screen, (18,18,24), rect, 1)




  for m in monsters:
      if m.pos not in visible:
          continue
      wy, wx = m.pos
      vx = wx - player.pos[1] + cx
      vy = wy - player.pos[0] + cy
      if 0 <= vx < view_w and 0 <= vy < view_h:
          rect = pygame.Rect(ox + vx*TILE, oy + vy*TILE, TILE, TILE)
          slow_border = (70, 170, 255) if m.slow_ms > 0 else None


          if m.kind == KIND_SNIPER:
              pygame.draw.rect(screen, (255, 0, 0), rect.inflate(-6, -6))
              pygame.draw.rect(screen, (60, 0, 0), rect.inflate(-6, -6), 2)


          elif m.kind == KIND_WITCH:
              # 번쩍 연출: blink_ms > 0이면 연보라로
              if getattr(m, "blink_ms", 0) > 0:
                  pygame.draw.rect(screen, (255, 190, 255), rect.inflate(-6, -6))
              else:
                  pygame.draw.rect(screen, (170, 60, 255), rect.inflate(-6, -6))
              pygame.draw.rect(screen, (30, 0, 60), rect.inflate(-6, -6), 2)


          elif m.kind == KIND_DIGGER:
              pygame.draw.rect(screen, (90, 255, 120), rect.inflate(-6, -6))
              pygame.draw.rect(screen, (20, 90, 30), rect.inflate(-6, -6), 2)


          else:
              pygame.draw.rect(screen, (220, 90, 150), rect.inflate(-6, -6))
              pygame.draw.rect(screen, (90, 35, 60), rect.inflate(-6, -6), 2)



          if slow_border:
              pygame.draw.rect(screen, slow_border, rect.inflate(-4,-4), 2)




  if boss is not None:
      blocks = boss.blocks()
      for (by,bx) in blocks:
          if (by,bx) not in visible:
              continue
          vx = bx - player.pos[1] + cx
          vy = by - player.pos[0] + cy
          if 0 <= vx < view_w and 0 <= vy < view_h:
              rect = pygame.Rect(ox + vx*TILE, oy + vy*TILE, TILE, TILE)
              if boss.phase == "BLINK" and boss.blink_toggle:
                  pygame.draw.rect(screen, (255, 190, 255), rect.inflate(-4,-4))
              else:
                  pygame.draw.rect(screen, (160, 60, 255), rect.inflate(-4,-4))
              pygame.draw.rect(screen, (30, 0, 60), rect.inflate(-4,-4), 2)




              if (by,bx) != boss.center:
                  if boss.leg_flip:
                      pygame.draw.rect(screen, (255, 220, 255), rect.inflate(-2,-2), 2)
                  else:
                      pygame.draw.rect(screen, (120, 20, 220), rect.inflate(-2,-2), 2)




  prect = pygame.Rect(ox + cx*TILE, oy + cy*TILE, TILE, TILE)
  pygame.draw.rect(screen, (215,245,255), prect.inflate(-6,-6))
  pygame.draw.rect(screen, (45,70,110), prect.inflate(-6,-6), 2)




def draw_attack_overlay(screen, tiles, player, view_w, view_h, ox, oy):
  if not tiles:
      return
  cx = view_w // 2
  cy = view_h // 2
  s = pygame.Surface((view_w*TILE, view_h*TILE), pygame.SRCALPHA)
  for (y,x) in tiles:
      vx = x - player.pos[1] + cx
      vy = y - player.pos[0] + cy
      if 0 <= vx < view_w and 0 <= vy < view_h:
          r = pygame.Rect(vx*TILE, vy*TILE, TILE, TILE)
          pygame.draw.rect(s, (255, 40, 40, 90), r)
          pygame.draw.rect(s, (255, 120, 120, 190), r, 2)
  screen.blit(s, (ox, oy))




def draw_sniper_warning(screen, warnings, player, view_w, view_h, ox, oy):
  if not warnings:
      return
  cx = view_w // 2
  cy = view_h // 2
  surf = pygame.Surface((view_w*TILE, view_h*TILE), pygame.SRCALPHA)




  for w in warnings:
      line = w["line"]
      t = w["t"]
      alpha = max(40, min(235, int(235 * (t / SNIPER_WARN_MS))))
      pts = []
      for (wy, wx) in line:
          vx = wx - player.pos[1] + cx
          vy = wy - player.pos[0] + cy
          if 0 <= vx < view_w and 0 <= vy < view_h:
              px = vx*TILE + TILE//2
              py = vy*TILE + TILE//2
              pts.append((px, py))
      col_main = w.get("col_main", (255, 0, 0))
      col_edge = w.get("col_edge", (255, 170, 170))


      if len(pts) >= 2:
          pygame.draw.lines(surf, (*col_main, alpha), False, pts, 5)
          pygame.draw.lines(surf, (*col_edge, min(255, alpha + 35)), False, pts, 2)


  screen.blit(surf, (ox, oy))




def draw_particles(screen, particles, player, visible, view_w, view_h, ox, oy):
  if not particles:
      return
  cx = view_w // 2
  cy = view_h // 2
  surf = pygame.Surface((view_w*TILE, view_h*TILE), pygame.SRCALPHA)
  for p in particles:
      ty = int(p.wy)
      tx = int(p.wx)
      if (ty, tx) not in visible:
          continue
      vx = (p.wx - player.pos[1] + cx) * TILE
      vy = (p.wy - player.pos[0] + cy) * TILE
      alpha = max(0, min(255, int(255 * (p.life / p.max_life))))
      col = (120, 200, 255, alpha) if p.kind == "spark" else (245, 235, 255, alpha)
      r = pygame.Rect(int(vx), int(vy), p.size, p.size)
      pygame.draw.rect(surf, col, r)
  screen.blit(surf, (ox, oy))




def draw_pet(screen, player, view_w, view_h, ox, oy):
  if player.pet_count <= 0:
      return
  cx = view_w // 2
  cy = view_h // 2
  px = ox + cx*TILE + TILE//2
  py = oy + cy*TILE + TILE//2
  offsets = [(-TILE//2, -TILE//2), (+TILE//2, -TILE//2), (-TILE//2, +TILE//2), (+TILE//2, +TILE//2)]
  for i in range(min(4, player.pet_count)):
      dx, dy = offsets[i]
      p2 = (px + dx, py + dy)
      pygame.draw.circle(screen, (80, 170, 255), p2, max(5, TILE//4))
      pygame.draw.circle(screen, (20, 70, 130), p2, max(5, TILE//4), 2)




def draw_pet_laser(screen, player, view_w, view_h, ox, oy):
  if player.pet_laser_ms <= 0 or (player.pet_laser_from is None) or (player.pet_laser_to is None):
      return
  cx = view_w // 2
  cy = view_h // 2
  (fy, fx) = player.pet_laser_from
  (ty, tx) = player.pet_laser_to




  fvx = fx - player.pos[1] + cx
  fvy = fy - player.pos[0] + cy
  tvx = tx - player.pos[1] + cx
  tvy = ty - player.pos[0] + cy
  if not (0 <= fvx < view_w and 0 <= fvy < view_h and 0 <= tvx < view_w and 0 <= tvy < view_h):
      return




  a = int(240 * (player.pet_laser_ms / 140))
  surf = pygame.Surface((view_w*TILE, view_h*TILE), pygame.SRCALPHA)
  p1 = (fvx*TILE + TILE//2, fvy*TILE + TILE//2)
  p2 = (tvx*TILE + TILE//2, tvy*TILE + TILE//2)
  pygame.draw.line(surf, (70, 170, 255, a), p1, p2, 8)
  pygame.draw.line(surf, (190, 235, 255, min(255, a+25)), p1, p2, 3)
  screen.blit(surf, (ox, oy))




def draw_inventory(screen, font, player):
  W, H = screen.get_width(), screen.get_height()
  rect = pygame.Rect(W//2 - 360, H//2 - 240, 720, 480)
  draw_panel(screen, rect)
  x = rect.x + 22
  y = rect.y + 18
  draw_text(screen, font, "INVENTORY (1~7 use/equip, G then 1~7 drop)", x, y, (255,255,255))
  y += 36


  for i in range(7):
      slot = player.inv[i]
      label = f"{i + 1}: (empty)"


      if slot:
          if isinstance(slot, PotionItem):
              label = f"{i + 1}: Potion (+{POTION_HEAL} HP)"
          elif isinstance(slot, CheapPotionItem):
              label = f"{i + 1}: Cheap Potion (50% +1 HP)"
          elif isinstance(slot, AmuletItem):
              label = f"{i + 1}: Amulet (BIG ERASE!)"
          elif isinstance(slot, TicketItem):
              label = f"{i + 1}: Ticket (upgrade random weapon -> Lv4)"
          elif isinstance(slot, WeaponItem):
              st = weapon_stats(slot.wtype, slot.level)
              extra = " (break furniture)" if st["break_furn"] else ""
              eq = " [EQUIPPED]" if player.equipped_idx == i else ""
              label = f"{i + 1}: {st['name']}{extra} (Lv{slot.level}) DMG {st['dmg']:g} R{st['range']} CD{st['cool_ms'] / 1000:.2f}s{eq}"
          else:
              label = f"{i + 1}: {getattr(slot, 'NAME', 'Unknown')}"


      draw_text(screen, font, label, x, y)
      y += 30


  y += 12
  st = player.current_weapon_stats()
  draw_text(screen, font, f"Equipped: {st['name']} | Angels x{player.pet_count} | HP {player.hp}/{player.max_hp} | Gems {player.gems} | SCORE {player.score}",
            x, y, (255,220,140))




def draw_shop(screen, font, player, floor, offers, sold, msg):
  W, H = screen.get_width(), screen.get_height()
  rect = pygame.Rect(W//2 - 370, H//2 - 260, 740, 520)
  draw_panel(screen, rect)




  x = rect.x + 22
  y = rect.y + 18
  draw_text(screen, font, f"SHOP - Floor {floor} (offers fixed this floor)", x, y, (255,255,255))
  y += 34
  draw_text(screen, font, f"Gems: {player.gems}", x, y, (255,220,140))
  y += 34
  draw_text(screen, font, "Buy: 1/2/3/4 | Enter: next floor | Esc: close", x, y, (205,205,220))
  y += 34




  for idx in range(4):
      if sold[idx] or offers[idx] is None:
          draw_text(screen, font, f"[{idx+1}] SOLD", x, y, (180,180,190))
          y += 30
          continue




      offer = offers[idx]
      t = offer["type"]
      if t == ITEM_POTION:
          line = f"[{idx+1}] Potion (+{POTION_HEAL} HP)  Cost {PRICE[ITEM_POTION]}"
      elif t == ITEM_MAXHP_PCT:
          line = f"[{idx+1}] MaxHP +{int(MAXHP_PCT_STEP*100)}% (instant)  Cost {PRICE[ITEM_MAXHP_PCT]}"
      elif t == ITEM_AMULET:
          line = f"[{idx+1}] Amulet (erase nearby)  Cost {PRICE[ITEM_AMULET]}"
      elif t == ITEM_TICKET:
          line = f"[{idx+1}] Ticket (upgrade random weapon -> Lv4) Cost {PRICE[ITEM_TICKET]}"
      elif t == ITEM_PET:
          line = f"[{idx+1}] Pet Angel (blue orb)  Cost {PRICE[ITEM_PET]}"
      else:
          wtype = offer["wtype"]
          best_lv = 0
          best_lv = 0
          for it in player.inv:
              if isinstance(it, WeaponItem) and it.wtype == wtype:
                  best_lv = max(best_lv, it.level)


          next_lv = best_lv + 1 if best_lv > 0 else 1
          st_next = weapon_stats(wtype, next_lv)
          extra = " (break furniture)" if WEAPONS[wtype]["break_furn"] else ""
          shield_note = ""
          if wtype == "SHIELD":
              shield_note = f" (block%~{int(shield_block_chance(next_lv)*100)}%)"
          line = f"[{idx+1}] {WEAPONS[wtype]['name']}{extra} -> Lv{next_lv} (R{st_next['range']} CD{st_next['cool_ms']/1000:.2f}s){shield_note} Cost {PRICE[wtype]}"
      draw_text(screen, font, line, x, y)
      y += 30




  y += 18
  if msg:
      draw_text(screen, font, msg, x, y, (255,220,140))




def draw_center_modal(screen, font, title, body):
  W, H = screen.get_width(), screen.get_height()
  rect = pygame.Rect(W//2 - 330, H//2 - 140, 660, 280)
  draw_panel(screen, rect, fill=(12,12,18), border=(120,120,160))
  x = rect.x + 26
  y = rect.y + 28
  draw_text(screen, font, title, x, y, (255,220,140))
  y += 46
  for line in body:
      draw_text(screen, font, line, x, y, (235,235,245))
      y += 28




def draw_info_screen(screen, font, font_big, lock_ms):
  overlay = pygame.Surface((screen.get_width(), screen.get_height()), pygame.SRCALPHA)
  overlay.fill((0,0,0,220))
  screen.blit(overlay, (0,0))




  cx = screen.get_width()//2
  y = 70
  draw_text(screen, font_big, "THE GHOST CITY", cx-240, y, (200,220,255))
  y += 70




  lines = [
      ("Goal: Reach Floor 20 and defeat the FINAL BOSS. (Mid-Boss on Floor 10)", (255,220,140)),
      ("", (230,230,240)),
      ("Controls:", (200,220,255)),
      ("- Move: WASD / Arrow Keys", (235,235,245)),
      ("- Attack: Space", (255,170,170)),
      ("- Inventory: I  |  Use/Equip: 1~7", (220,255,210)),
      ("- Drop: G then 1~7 (drops keep type+level)", (220,220,255)),
      ("- Elevator: E (up to Floor 8; Floor 9 disabled)", (255,220,140)),
      ("- ESC: Quit to Start Screen (paused confirm)", (255,170,170)),
      ("", (230,230,240)),
      ("Enemies:", (200,220,255)),
      ("- Pink: Melee (touch damage + knockback)", (255,180,210)),
      ("- Red: Sniper (warning line)", (255,120,120)),
      ("- Green: Digger (breaks walls)", (170,255,190)),
      ("", (230,230,240)),
      ("Treasure Room:", (200,220,255)),
      ("- 50% chance per map (purple floor, more gems & items).", (190,160,255)),
      ("- VERY rare: Ticket (iridescent). Use -> upgrade random weapon to Lv4.", (210,240,255)),
      ("", (230,230,240)),
      ("Press ENTER to start (after 1 second).", (255,220,140))
  ]




  x0 = 90
  for t, c in lines:
      draw_text(screen, font, t, x0, y, c)
      y += 26




  if lock_ms > 0:
      draw_text(screen, font, f"(Input locked: {lock_ms/1000:.1f}s)", 90, screen.get_height()-60, (255,220,140))




def draw_start_screen(screen, font, font_big, ranks, name_buf, blink_t):
  W,H = screen.get_width(), screen.get_height()
  screen.fill((10,10,18))
  title_y = 70
  draw_text(screen, font_big, "THE GHOST CITY", W//2 - 240, title_y, (200,220,255))




  # leaderboard panel
  rect = pygame.Rect(W//2 - 360, 170, 720, 360)
  draw_panel(screen, rect, fill=(16,16,26), border=(80,80,120))
  x = rect.x + 26
  y = rect.y + 18
  draw_text(screen, font, "RANKING (Top 10)", x, y, (255,220,140))
  y += 34
  if not ranks:
      draw_text(screen, font, "No records yet.", x, y, (200,200,210))
  else:
      for i, it in enumerate(ranks[:RANK_TOP]):
          draw_text(screen, font, f"{i+1:>2}. {it['name']:<18}  {it['score']}", x, y, (235,235,245))
          y += 28




  # name input panel
  rect2 = pygame.Rect(W//2 - 360, 560, 720, 160)
  draw_panel(screen, rect2, fill=(16,16,26), border=(80,80,120))
  x2 = rect2.x + 26
  y2 = rect2.y + 18
  draw_text(screen, font, "Enter your name, then press ENTER:", x2, y2, (235,235,245))
  y2 += 40




  caret = "_" if (blink_t // 350) % 2 == 0 else " "
  show = (name_buf if name_buf else "") + caret
  draw_text(screen, font_big, show[:16], x2, y2, (220,255,210))




  draw_text(screen, font, "Backspace: delete | ESC: exit game", x2, rect2.bottom - 34, (200,200,210))




# =========================
# Game States
# =========================
STATE_ADMIN = "ADMIN_PASS"   # add
ADMIN_PASS = "4931"          # add
admin_buf = ""
admin_msg = ""


STATE_START = "START"
STATE_TUTOR = "TUTORIAL"
STATE_INFO  = "INFO"
STATE_PLAY  = "PLAY"
STATE_INV   = "INV"
STATE_SHOP  = "SHOP"
STATE_QUIT  = "QUIT_CONFIRM"
STATE_END   = "ENDING"
STATE_DEAD  = "DEAD"




# =========================
# Elevator
# =========================
ELEV_COST_GEMS = 5
#ELEV_BROKE_DMG = 1
ELEV_OK_JUMP_MIN, ELEV_OK_JUMP_MAX = 1,1
ELEV_BROKE_JUMP_MIN, ELEV_BROKE_JUMP_MAX = 1, 1




# =========================
# MAIN
# =========================
def main(start_floor_override=1, luck=0.16, mega_package=False):
  pygame.init()
  pygame.display.set_caption("The Ghost City")
  screen = pygame.display.set_mode((0, 0), pygame.FULLSCREEN)
  # --- PATCH: keep keyboard input alive in fullscreen ---
  pygame.event.set_grab(True)  # lock input to this window
  pygame.mouse.set_visible(False)  # optional (nice for fullscreen)
  clock = pygame.time.Clock()
  font = pygame.font.SysFont("consolas", 18)
  font_big = pygame.font.SysFont("consolas", 44, bold=True)
  font_huge = pygame.font.SysFont("consolas", 72, bold=True)




  def recompute_view():
      info = pygame.display.Info()
      sw, sh = info.current_w, info.current_h
      view_w = max(11, sw // TILE)
      view_h = max(9, (sh - UI_H) // TILE)
      if view_w % 2 == 0: view_w -= 1
      if view_h % 2 == 0: view_h -= 1
      return view_w, view_h




  VIEW_W, VIEW_H = recompute_view()




  # ranking
  ranks = RANKINGS
  name_buf = ""
  player_name = "NONAME"
  blink_t = 0




  # run submission guard
  run_active = False
  run_submitted = False




  # world
  ground_weapons = {}
  ground_tickets = {}
  treasure_cells = set()




  def score_add(player, amount):
      player.score += max(0, int(amount))




  state = STATE_START
  floor = 1
  grid = build_floor_tutorial()
  player = Player((2,2))
  monsters = []
  boss = None
  seen = set()
  visible = set()




  msg = ""
  dead = False
  ending = False




  move_cd = 0
  atk_cd = 0
  atk_flash = 0
  atk_tiles = []




  sniper_warnings = []
  particles = []
  drop_mode = False




  shop_offers = None
  shop_sold = None
  shop_msg = ""
  shop_floor_id = 1




  info_lock_ms = 0




  def refresh_elev_and_stair():
      nonlocal elev_ok, elev_x, up_pos
      elev_ok = set(get_positions(grid, ELEV_OK))
      elev_x  = set(get_positions(grid, ELEV_BROKE))
      up_list = get_positions(grid, STAIR_UP)
      up_pos = up_list[0] if up_list else None




  elev_ok=set(); elev_x=set(); up_pos=None
  refresh_elev_and_stair()




  def start_new_run():
      nonlocal state, floor, grid, player, monsters, boss, seen, visible, msg, dead, ending
      nonlocal move_cd, atk_cd, atk_flash, atk_tiles, sniper_warnings, particles, drop_mode
      nonlocal shop_offers, shop_sold, shop_msg, shop_floor_id, ground_weapons, ground_tickets, treasure_cells
      nonlocal run_active, run_submitted




      # new run begins at tutorial
      state = STATE_TUTOR
      floor = 1
      grid = build_floor_tutorial()
      player = Player((2,2))
      monsters = []
      boss = None
      seen=set(); visible=set()
      msg = "Tutorial: Move / Attack Space / Pick items. Step on yellow tile then Enter."
      dead=False; ending=False
      move_cd=atk_cd=atk_flash=0
      atk_tiles=[]
      sniper_warnings=[]
      particles=[]
      drop_mode=False
      shop_offers=None; shop_sold=None; shop_msg=""
      ground_weapons={}
      ground_tickets={}
      treasure_cells=set()
      run_active = True
      run_submitted = False


      player.try_add_item_to_slot(CheapPotionItem())
      if mega_package:
          player.try_add_item_to_slot(WeaponItem("HAMMER", level=3))
          player.try_add_item_to_slot(WeaponItem("SPEAR", level=3))
          player.try_add_item_to_slot(WeaponItem("SHIELD", level=3))
          player.pet_count = 2
          player.equipped_idx = 1
      else:
          player.try_add_item_to_slot(WeaponItem("SPEAR", level=-3))
          player.equipped_idx = 1


      refresh_elev_and_stair()
      return player




  def submit_run_score(final_score):
      nonlocal ranks, run_submitted, run_active
      if run_submitted:
          return
      if not run_active:
          return
      ranks = add_ranking_in_memory(player_name, final_score)
      run_submitted = True
      run_active = False




  def go_to_start():
      nonlocal state, msg, dead, ending, drop_mode, shop_offers, shop_sold, shop_msg
      state = STATE_START
      msg = ""
      dead = False
      ending = False
      drop_mode = False
      shop_offers=None; shop_sold=None; shop_msg=""




  def start_floor_by_number(floor_num):
      nonlocal grid, monsters, boss, seen, visible, shop_offers, shop_sold, shop_msg, shop_floor_id, ground_weapons, ground_tickets, treasure_cells
      ground_weapons = {}
      ground_tickets = {}
      treasure_cells = set()


      if floor_num in BOSS_FLOORS:
          # ✅ PATCH: 보스 아레나 생성
          grid = build_floor_boss()
          h = len(grid)
          w = len(grid[0])


          monsters = []


          # 보스 생성(중간/최종만 HP 다르게)
          if floor_num == 10:
              boss = Boss(center=(4, w // 2), hp=72)
          else:
              boss = Boss(center=(4, w // 2), hp=96)


          # ✅ PATCH: 플레이어 기본 위치 후보를 EMPTY로 보정 + 보스블록 피하기
          prefer = (h - 4, w // 2)
          if not (in_bounds(h, w, prefer[0], prefer[1]) and is_walkable(grid[prefer[0]][prefer[1]]) and
                  grid[prefer[0]][prefer[1]] not in (WALL, FURN)):
              # 주변에서 빈칸 찾아서 보정
              found = None
              for dy in range(0, 6):
                  for dx in range(-6, 7):
                      y = h - 4 - dy
                      x = w // 2 + dx
                      if in_bounds(h, w, y, x) and is_walkable(grid[y][x]) and grid[y][x] == EMPTY:
                          found = (y, x)
                          break
                  if found:
                      break
              prefer = found if found else prefer


          # 보스 몸통(5칸) 안/인접이면 피하기
          if boss is not None and prefer in boss.blocks():
              # 한 칸 아래로 내리거나 옆으로 밀기
              for cand in [(prefer[0] + 1, prefer[1]), (prefer[0], prefer[1] - 1), (prefer[0], prefer[1] + 1),
                           (prefer[0] + 2, prefer[1])]:
                  y, x = cand
                  if in_bounds(h, w, y, x) and grid[y][x] == EMPTY:
                      prefer = cand
                      break


          # ✅ 몹이 없지만, 혹시 이상하게 막혔을 때를 대비한 안전 스폰(그리드 기반)
          player.pos, _ = ensure_safe_spawn(grid, [], prefer=prefer, min_dist=0)


          if floor_num == MID_BOSS_FLOOR:
              boss = Boss(center=(4, w // 2), hp=72)  # 중간보스는 체력 낮게
          else:
              boss = Boss(center=(4, w // 2), hp=96)  # 최종보스


      else:
          grid, spawned, treasure_cells = build_floor_normal(floor_num, luck)
          monsters = spawn_monsters_from_grid(grid, spawned, floor_num)
          # ✅ PATCH: 일반층도 안전 스폰 강제(벽/가구/몹 근처 스폰 방지)
          prefer = player.pos
          player.pos, monsters = ensure_safe_spawn(grid, monsters, prefer=prefer, min_dist=4)


          boss = None


      player.spear_dash_used = False
      player.is_dashing = False
      player.dash_iframes_ms = 0
      player.hurt_iframes_ms = 0




      seen=set(); visible=set()
      shop_offers=None; shop_sold=None; shop_msg=""
      shop_floor_id=floor_num
      refresh_elev_and_stair()
      return floor_num


  def drop_item_on_ground(item):
      py, px = player.pos
      for (y, x) in [(py, px), (py + 1, px), (py - 1, px), (py, px + 1), (py, px - 1)]:
          if in_bounds(len(grid), len(grid[0]), y, x) and grid[y][x] == EMPTY:
              if isinstance(item, WeaponItem):
                  grid[y][x] = WEAPON_GROUND
                  ground_weapons[(y, x)] = item.clone()
              elif isinstance(item, AmuletItem):
                  grid[y][x] = AMULET_GROUND
              elif isinstance(item, TicketItem):
                  grid[y][x] = TICKET_GROUND
                  ground_tickets[(y, x)] = True
              else:
                  grid[y][x] = POTION_GROUND
              spawn_break_fx(particles, x, y, amount=18, kind="spark")
              return True
      return False


  # start menu -> name already typed
  # =========================
  # loop
  # =========================
  while True:
      # --- PATCH: emergency unstick ---
      #이건언제든지없애도됨(이 이프문만)
      if state == STATE_TUTOR and floor != 1 and grid is not None:
          # If somehow tutorial state is active outside tutorial flow, force back to PLAY.
          state = STATE_PLAY


      dt = clock.tick(FPS)
      # --- PATCH: make sure pygame updates keyboard state every frame ---
      pygame.event.pump()
      blink_t += dt




      # PAUSE logic: PLAY/TUTOR only run simulation
      sim_running = (state in (STATE_PLAY, STATE_TUTOR)) and (not dead) and (not ending)
      dt_sim = dt if sim_running else 0




      move_cd = max(0, move_cd - dt_sim)
      atk_cd = max(0, atk_cd - dt_sim)
      atk_flash = max(0, atk_flash - dt_sim)
      player.pet_laser_ms = max(0, player.pet_laser_ms - dt_sim)
      player.hit_flash_ms = max(0, player.hit_flash_ms - dt_sim)
      player.shake_ms = max(0, player.shake_ms - dt_sim)
      player.pet_cd_ms = max(0, player.pet_cd_ms - dt_sim)
      player.dash_iframes_ms = max(0, player.dash_iframes_ms - dt_sim)
      player.hurt_iframes_ms = max(0, player.hurt_iframes_ms - dt_sim)
      if player.dash_iframes_ms == 0:
          player.is_dashing = False




      info_lock_ms = max(0, info_lock_ms - dt)




      for w in sniper_warnings:
          w["t"] -= dt_sim
      sniper_warnings = [w for w in sniper_warnings if w["t"] > 0]




      for p in particles:
          p.update(dt_sim)
      particles = [p for p in particles if p.alive()]




      for m in monsters:
          if m.slow_ms > 0:
              m.slow_ms = max(0, m.slow_ms - dt_sim)
          mult = m.tick_mult()
          if m.kind == KIND_SNIPER:
              m.shoot_cd_ms = max(0, m.shoot_cd_ms - dt_sim * mult)
          if m.kind == KIND_DIGGER:
              m.dig_cd_ms = max(0, m.dig_cd_ms - dt_sim * mult)
          m.move_accum += dt_sim * mult




      if state in (STATE_PLAY, STATE_TUTOR, STATE_INV, STATE_SHOP, STATE_INFO, STATE_QUIT, STATE_DEAD, STATE_END):
          fov_r = theme_cfg(floor)["fov"]
          visible = compute_fov(grid, player.pos, fov_r)


          seen |= visible
      else:
          visible = set()
          seen = set()




      # boss update
      if dt_sim > 0 and state == STATE_PLAY and boss is not None:
          broken = boss.update(dt_sim, grid, player.pos)
          for (by,bx,c) in broken:
              spawn_break_fx(particles, bx, by, amount=36, kind="debris" if c in (WALL,FURN) else "spark")
              if c == WEAPON_GROUND:
                  ground_weapons.pop((by,bx), None)
              if c == TICKET_GROUND:
                  ground_tickets.pop((by,bx), None)
              if c == WALL:
                  treasure_cells.discard((by,bx))




          if (not boss.summon_66) and boss.hp <= int(boss.max_hp * 0.66):
              boss.summon_66 = True
              msg = "BOSS summons!"
              cy,cx0 = boss.center
              for _ in range(4):
                  for __ in range(80):
                      y = cy + random.randint(-6, 6)
                      x = cx0 + random.randint(-6, 6)
                      if in_bounds(len(grid), len(grid[0]), y, x) and grid[y][x] == EMPTY and (y,x) not in boss.blocks():
                          monsters.append(Monster((y,x), KIND_MELEE, floor))
                          spawn_break_fx(particles, x, y, amount=20, kind="spark")
                          break
          if (not boss.summon_33) and boss.hp <= int(boss.max_hp * 0.33):
              boss.summon_33 = True
              msg = "BOSS summons again!"
              cy,cx0 = boss.center
              for _ in range(4):
                  for __ in range(80):
                      y = cy + random.randint(-7, 7)
                      x = cx0 + random.randint(-7, 7)
                      if in_bounds(len(grid), len(grid[0]), y, x) and grid[y][x] == EMPTY and (y,x) not in boss.blocks():
                          monsters.append(Monster((y,x), KIND_MELEE, floor))
                          spawn_break_fx(particles, x, y, amount=20, kind="spark")
                          break




          if boss.is_colliding(player.pos):
              dead_now, mmsg = apply_damage(player, boss.touch_dmg, particles, msg_prefix="BOSS HIT! ")
              msg = mmsg
              if dead_now:
                  dead = True
                  state = STATE_DEAD
                  msg = "GAME OVER (Enter: restart, ESC: start)"
                  submit_run_score(player.score)




      if dt_sim > 0 and state == STATE_PLAY and (not dead) and (not ending):
          monsters, pet_msg = pet_attack(player, monsters, boss, visible, dt_sim, particles, grid, lambda s: score_add(player, s))
          if pet_msg:
              msg = pet_msg




      # =========================
      # INPUT
      # =========================
      for event in pygame.event.get():
          # --- PATCH: recover focus/input when OS steals it ---
          if event.type == pygame.WINDOWFOCUSLOST:
              pygame.event.set_grab(False)
              continue


          if event.type == pygame.WINDOWFOCUSGAINED:
              pygame.event.set_grab(True)
              continue


          if event.type == pygame.QUIT:
              pygame.quit(); return




          if event.type == pygame.KEYDOWN:
              # START screen input
              if state == STATE_START:
                  if event.key == pygame.K_ESCAPE:
                      admin_buf = ""
                      admin_msg = "Enter admin password to exit."
                      state = STATE_ADMIN
                      continue
                  if event.key == pygame.K_BACKSPACE:
                      name_buf = name_buf[:-1]
                  elif event.key == pygame.K_RETURN:
                      if name_buf.strip():
                          player_name = name_buf.strip()[:16]
                          start_new_run()
                      else:
                          pass
                  else:
                      ch = event.unicode
                      if ch and ch.isprintable() and ch not in "\r\n\t":
                          if len(name_buf) < 16:
                              name_buf += ch
                  continue
              if state == STATE_ADMIN:
                  if event.key == pygame.K_ESCAPE:
                      state = STATE_START
                      admin_msg = ""
                      continue


                  if event.key == pygame.K_BACKSPACE:
                      admin_buf = admin_buf[:-1]
                      continue


                  if event.key == pygame.K_RETURN:
                      if admin_buf == ADMIN_PASS:
                          pygame.quit();
                          return
                      else:
                          admin_msg = "Wrong password."
                          admin_buf = ""
                      continue


                  ch = event.unicode
                  if ch and ch.isdigit() and len(admin_buf) < 8:
                      admin_buf += ch
                  continue


              # ESC behavior: always open quit-confirm to START (not close app)
              if event.key == pygame.K_ESCAPE:
                  if state in (STATE_INV, STATE_SHOP):
                      state = STATE_PLAY
                      msg = ""
                      drop_mode = False
                  elif state in (STATE_PLAY, STATE_TUTOR, STATE_INFO):
                      state = STATE_QUIT
                      drop_mode = False
                  elif state == STATE_QUIT:
                      state = STATE_PLAY if (run_active and not dead and not ending) else STATE_START
                  elif state in (STATE_DEAD, STATE_END):
                      # go to start screen (already submitted)
                      go_to_start()
                  continue




              # quit confirm
              if state == STATE_QUIT:
                  if event.key == pygame.K_y:
                      # submit current score and return to start
                      if run_active and not run_submitted:
                          submit_run_score(player.score)
                      go_to_start()
                  elif event.key == pygame.K_n:
                      state = STATE_PLAY if (run_active and not dead and not ending) else STATE_START
                  continue



              # DEAD/END restart with Enter
              if state == STATE_DEAD and event.key == pygame.K_RETURN:
                  # already submitted on death
                  start_new_run()
                  continue




              if state == STATE_END and event.key == pygame.K_RETURN:
                  # already submitted on ending
                  start_new_run()
                  continue




              # Tutorial Enter -> Info (always works)
              if state == STATE_TUTOR and event.key == pygame.K_RETURN:
                  if grid[player.pos[0]][player.pos[1]] == TUTOR_EXIT:
                      state = STATE_INFO
                      info_lock_ms = 1000
                      msg = ""
                  else:
                      msg = "Go to the yellow exit tile, then press Enter."
                  continue




              # Info -> Play
              if state == STATE_INFO and event.key == pygame.K_RETURN and info_lock_ms == 0:
                  state = STATE_PLAY
                  floor = max(1, int(start_floor_override))
                  if floor > FINAL_BOSS_FLOOR:
                      floor = FINAL_BOSS_FLOOR
                  floor = start_floor_by_number(floor)
                  msg = f"Floor {floor} start!"
                  drop_mode = False
                  continue




              # In tutorial: ignore inventory/drop/shop keys (bug fix)
              if state == STATE_TUTOR:
                  # allow attack only
                  if event.key == pygame.K_SPACE:
                      if atk_cd == 0:
                          st = player.current_weapon_stats()
                          atk_cd = st["cool_ms"]
                          atk_flash = ATTACK_FLASH_MS
                          atk_tiles = compute_attack_line(grid, player.pos, player.facing, st["range"])
                          msg = "Attack!"
                  continue




              # inventory toggle
              if (not dead) and (not ending):
                  if event.key == pygame.K_i and state != STATE_QUIT:
                      if state == STATE_INV:
                          state = STATE_PLAY
                      elif state == STATE_PLAY:
                          state = STATE_INV
                      drop_mode = False




                  if event.key == pygame.K_g and state in (STATE_PLAY, STATE_INV):
                      drop_mode = not drop_mode
                      msg = "DROP MODE: press 1~7" if drop_mode else ""




                  if state in (STATE_PLAY, STATE_INV) and (pygame.K_1 <= event.key <= pygame.K_7):
                      idx = event.key - pygame.K_1
                      if drop_mode:
                          it = player.inv[idx]
                          if it is None:
                              msg = "Empty slot."
                          else:
                              removed = player.remove_item_from_slot(idx)
                              ok = drop_item_on_ground(removed)
                              if ok:
                                  msg = "Dropped."
                              else:
                                  player.inv[idx] = removed
                                  msg = "No space to drop."
                          drop_mode = False
                      else:
                          out = player.use_slot(idx)
                          if out == "__USE_AMULET__":
                              state = STATE_PLAY
                              drop_mode = False
                              player.shake_ms = 520
                              player.shake_pow = 16
                              player.hit_flash_ms = 120
                              spawn_break_fx(particles, player.pos[1], player.pos[0], amount=60, kind="spark")
                              monsters, info = amulet_blast(grid, player.pos, monsters, boss, particles, ground_weapons, ground_tickets, radius=7)
                              rw, rf, ri, rm = info
                              if rm > 0:
                                  score_add(player, rm * SCORE_KILL)
                                  player.gain_xp(rm * XP_KILL)
                              msg = f"AMULET! erased W{rw} F{rf} I{ri} M{rm}"
                          else:
                              msg = out




                  if state == STATE_SHOP:
                      if event.key == pygame.K_RETURN:
                          if floor >= FINAL_BOSS_FLOOR:
                              state = STATE_PLAY
                          else:
                              floor += 1
                              score_add(player, SCORE_FLOOR_ADVANCE)
                              player.gain_xp(XP_FLOOR_ADVANCE)
                              if floor >= FINAL_BOSS_FLOOR:
                                  floor = start_floor_by_number(FINAL_BOSS_FLOOR)
                                  msg = "FINAL: BOSS ARENA!"
                              else:
                                  floor = start_floor_by_number(floor)
                                  msg = f"Floor {floor}..."
                              particles=[]
                              drop_mode=False
                          state = STATE_PLAY




                      if pygame.K_1 <= event.key <= pygame.K_4:
                          idx = event.key - pygame.K_1
                          if shop_offers and shop_sold and 0 <= idx < 4:
                              if shop_sold[idx]:
                                  shop_msg = "Sold out."
                              else:
                                  ok, sm = buy_offer(player, shop_offers[idx])
                                  shop_msg = sm
                                  if ok:
                                      shop_sold[idx] = True




                  # attack / dash only in PLAY
                  if state == STATE_PLAY and event.key == pygame.K_SPACE:
                      shift = pygame.key.get_mods() & pygame.KMOD_SHIFT
                      if shift:
                          monsters, out = spear_dash(player, grid, monsters, boss, particles, ground_weapons, ground_tickets, lambda s: score_add(player, s), treasure_cells)
                          msg = out
                      else:
                          st = player.current_weapon_stats()
                          if atk_cd == 0:
                              atk_cd = st["cool_ms"]
                              atk_flash = ATTACK_FLASH_MS
                              atk_tiles = compute_attack_line(grid, player.pos, player.facing, st["range"])
                              tset = set(atk_tiles)


                              dmg = float(st.get("dmg", 1.0))


                              hit_any = False
                              dead_count = 0
                              # ✅ PATCH: 망치(또는 break_furn 무기)는 가구 파괴
                              if st.get("break_furn", False):
                                  broke = 0
                                  for (ty, tx) in atk_tiles:
                                      if in_bounds(len(grid), len(grid[0]), ty, tx) and grid[ty][tx] == FURN:
                                          grid[ty][tx] = EMPTY
                                          spawn_break_fx(particles, tx, ty, amount=28, kind="debris")
                                          broke += 1
                                  if broke > 0:
                                      hit_any = True
                                      msg = f"SMASH! broke furn x{broke}"


                              new_monsters = []


                              for m in monsters:
                                  if m.pos in tset:
                                      hit_any = True
                                      m.hp -= dmg
                                      spawn_break_fx(particles, m.pos[1], m.pos[0], amount=18, kind="spark")


                                      if m.hp <= 0:
                                          dead_count += 1
                                          score_add(player, SCORE_KILL)
                                          player.gain_xp(XP_KILL)
                                          spawn_break_fx(particles, m.pos[1], m.pos[0], amount=26, kind="spark")
                                      else:
                                          new_monsters.append(m)
                                  else:
                                      new_monsters.append(m)


                              monsters = new_monsters


                              # ✅ BOSS hit (player weapon)
                              if boss is not None and any(b in tset for b in boss.blocks()):
                                  boss.hp -= dmg
                                  score_add(player, SCORE_BOSS_HIT)
                                  spawn_break_fx(particles, boss.center[1], boss.center[0], amount=30, kind="spark")
                                  hit_any = True
                                  msg = f"Hit BOSS! (-{dmg:g})"


                              if hit_any:
                                  msg = f"Hit! dead {dead_count}." if dead_count > 0 else f"Hit! (-{dmg:g})"
                              else:
                                  msg = "Whoosh..."


                  # elevator
                  if state == STATE_PLAY and event.key == pygame.K_e and boss is None:
                      if floor in (9, 19):
                          msg = f"Elevator disabled on Floor {floor}."


                      else:
                          on_ok = player.pos in elev_ok
                          on_bk = player.pos in elev_x
                          if on_ok or on_bk:
                              if player.gems < ELEV_COST_GEMS:
                                  msg = f"Need {ELEV_COST_GEMS} gem."
                              else:
                                  player.gems -= ELEV_COST_GEMS
                                  jump = random.randint(ELEV_OK_JUMP_MIN, ELEV_OK_JUMP_MAX) if on_ok else random.randint(ELEV_BROKE_JUMP_MIN, ELEV_BROKE_JUMP_MAX)


                                  if on_bk:
                                      # (PATCH) damage = half of CURRENT HP (favorable). hp=1 -> 0 dmg.
                                      broke_dmg = max(0, player.hp // 2)


                                      dead_now, mmsg = apply_damage(
                                          player,
                                          broke_dmg,
                                          particles,
                                          msg_prefix=f"Broken elevator! (-{broke_dmg}) "
                                      )
                                      msg = mmsg + f" Jump +{jump}!"


                                      if dead_now:
                                          dead = True
                                          state = STATE_DEAD
                                          msg = "Broken elevator killed you. (Enter: restart, ESC: start)"
                                          submit_run_score(player.score)


                                  else:
                                      msg = f"Elevator boost! Jump +{jump} floors!"




                                  if not dead:
                                      new_floor = min(MAX_NORMAL_FLOOR, floor + jump)
                                      advanced = new_floor - floor
                                      if advanced > 0:
                                          score_add(player, SCORE_FLOOR_ADVANCE * advanced)
                                          player.gain_xp(XP_FLOOR_ADVANCE * advanced)
                                      floor = start_floor_by_number(new_floor)
                                      msg = f"Floor {floor}..."
                                      particles=[]
                                      drop_mode=False
                          else:
                              msg = "No elevator here."




      # =========================
      # MOVEMENT + PICKUPS + SHOP
      # =========================
      keys = pygame.key.get_pressed()
      if dt_sim > 0 and state in (STATE_PLAY, STATE_TUTOR):
          dy = dx = 0
          if move_cd == 0:
              if keys[pygame.K_LEFT] or keys[pygame.K_a]:
                  dx = -1; player.facing = "L"
              elif keys[pygame.K_RIGHT] or keys[pygame.K_d]:
                  dx = 1;  player.facing = "R"
              elif keys[pygame.K_UP] or keys[pygame.K_w]:
                  dy = -1; player.facing = "U"
              elif keys[pygame.K_DOWN] or keys[pygame.K_s]:
                  dy = 1;  player.facing = "D"




              if dy != 0 or dx != 0:
                  ny, nx = player.pos[0] + dy, player.pos[1] + dx
                  if in_bounds(len(grid), len(grid[0]), ny, nx) and is_walkable(grid[ny][nx]) and grid[ny][nx] not in (WALL, FURN):
                      player.pos = (ny, nx)
                  move_cd = 90


                  c = grid[player.pos[0]][player.pos[1]]
                  t = tile_of(c)
                  step_msg = t.on_step(player, grid, particles, lambda s: score_add(player, s),
                                       ground_weapons, ground_tickets, treasure_cells)
                  if step_msg:
                      msg = step_msg


                  if state == STATE_PLAY and boss is None and up_pos and player.pos == up_pos:
                      if shop_floor_id != floor:
                          shop_offers = None
                          shop_sold = None
                          shop_msg = ""
                          shop_floor_id = floor
                      if shop_offers is None:
                          shop_offers = pick_shop_offers3(player, floor, luck)
                          shop_sold = [False, False, False, False]
                      state = STATE_SHOP
                      shop_msg = "Fixed offers. 1~4 buy. Enter: next floor."
                      msg = ""
                      drop_mode = False




      # =========================
      # MONSTER ACTIONS (anti-overlap attack)
      # =========================
      if dt_sim > 0 and state == STATE_PLAY and boss is None and (not dead):
          # sniper / witch ranged
          for m in monsters:
              if m.kind in (KIND_SNIPER, KIND_WITCH):
                  # WITCH: "본 시간" 누적 + 4초마다 소환
                  if m.kind == KIND_WITCH:
                      if m.blink_ms > 0:
                          m.blink_ms = max(0, m.blink_ms - dt_sim)


                      if m.can_see_player(grid, player.pos, visible):
                          m.see_ms += dt_sim
                      else:
                          m.see_ms = 0


                      if m.see_ms >= 4000:
                          m.see_ms = 0
                          m.blink_ms = 450  # 번쩍 타임(연출용)


                          # 핑크 2마리 소환 (주변 빈칸)
                          spawned = 0
                          for _ in range(80):
                              if spawned >= 2:
                                  break
                              y = m.pos[0] + random.randint(-2, 2)
                              x = m.pos[1] + random.randint(-2, 2)
                              if not in_bounds(len(grid), len(grid[0]), y, x):
                                  continue
                              if not in_inner(len(grid), len(grid[0]), y, x, BORDER):
                                  continue
                              if grid[y][x] != EMPTY:
                                  continue
                              if any(mm.pos == (y, x) for mm in monsters):
                                  continue
                              if (y, x) == player.pos:
                                  continue
                              monsters.append(Monster((y, x), KIND_MELEE, floor))
                              spawn_break_fx(particles, x, y, amount=18, kind="spark")
                              spawned += 1


                  # 발사 (WITCH는 3배 느리게)
                  if m.shoot_cd_ms == 0 and m.can_shoot(grid, player.pos, visible):
                      line = bresenham_line(m.pos, player.pos)


                      if m.kind == KIND_WITCH:
                          sniper_warnings.append({
                              "line": line, "t": SNIPER_WARN_MS,
                              "col_main": (170, 60, 255),  # 보라
                              "col_edge": (255, 190, 255)  # 연보라
                          })
                          dead_now, mmsg = apply_damage(player, m.base_dmg, particles, msg_prefix="WITCH! ")
                          msg = mmsg
                          m.shoot_cd_ms = 2700  # 스나이퍼(900)의 3배
                      else:
                          sniper_warnings.append({"line": line, "t": SNIPER_WARN_MS})
                          dead_now, mmsg = apply_damage(player, m.base_dmg, particles, msg_prefix="SNIPER! ")
                          msg = mmsg
                          m.shoot_cd_ms = 900


                      if dead_now:
                          dead = True
                          state = STATE_DEAD
                          msg = "GAME OVER (Enter: restart, ESC: start)"
                          submit_run_score(player.score)
                          break


          if not dead:
              blocked = {m.pos for m in monsters}
              newpos = set()
              for m in monsters:
                  if m.move_accum < MON_MOVE_MS:
                      continue
                  m.move_accum -= MON_MOVE_MS
                  blocked.discard(m.pos)




                  if m.kind == KIND_SNIPER and random.random() < 0.55:
                      newpos.add(m.pos); blocked.add(m.pos)
                      continue




                  prev = m.pos
                  step = m.step_toward(grid, player.pos, blocked | newpos)




                  # 핵심: 몹이 플레이어 타일로 "들어오지 않음"
                  if step == player.pos:
                      # attack from prev position
                      dead_now, mmsg = apply_damage(player, m.base_dmg, particles, msg_prefix="Melee hit! ")
                      if not dead_now:
                          # knockback from prev (not same-tile)
                          player.pos = try_knockback_1(grid, player.pos, prev)
                      msg = mmsg
                      if dead_now:
                          dead = True
                          state = STATE_DEAD
                          msg = "GAME OVER (Enter: restart, ESC: start)"
                          submit_run_score(player.score)
                          break
                      # stay at prev (no overlap)
                      m.pos = prev
                      newpos.add(prev); blocked.add(prev)
                      continue




                  # normal move
                  m.pos = step
                  newpos.add(step)
                  blocked.add(step)




                  if m.kind == KIND_DIGGER and m.last_broke is not None:
                      by, bx = m.last_broke
                      spawn_break_fx(particles, bx, by, amount=42, kind="debris")
                      m.last_broke = None




      # Boss floor minions
      if dt_sim > 0 and state == STATE_PLAY and boss is not None and (not dead):
          blocked = {m.pos for m in monsters}
          newpos = set()
          for m in monsters:
              if m.move_accum < MON_MOVE_MS:
                  continue
              m.move_accum -= MON_MOVE_MS
              blocked.discard(m.pos)




              prev = m.pos
              step = m.step_toward(grid, player.pos, blocked | newpos)
              if step == player.pos:
                  dead_now, mmsg = apply_damage(player, m.base_dmg, particles, msg_prefix="Minion hit! ")
                  if not dead_now:
                      player.pos = try_knockback_1(grid, player.pos, prev)
                  msg = mmsg
                  if dead_now:
                      dead = True
                      state = STATE_DEAD
                      msg = "GAME OVER (Enter: restart, ESC: start)"
                      submit_run_score(player.score)
                      break
                  m.pos = prev
                  newpos.add(prev); blocked.add(prev)
                  continue




              m.pos = step
              newpos.add(step)
              blocked.add(step)




          if boss.hp <= 0 and not ending:
              ending = True
              state = STATE_END
              msg = "BOSS DEFEATED!"
              score_add(player, SCORE_BOSS_KILL)
              spawn_break_fx(particles, boss.center[1], boss.center[0], amount=120, kind="spark")
              final_score = int(player.score * ENDING_MULT)
              submit_run_score(final_score)




      # =========================
      # DRAW
      # =========================
      screen.fill((0,0,0))




      if state == STATE_START:
          draw_start_screen(screen, font, font_big, ranks, name_buf, blink_t)
          pygame.display.flip()
          continue




      shake_x = shake_y = 0
      if player.shake_ms > 0:
          amp = player.shake_pow
          shake_x = random.randint(-amp, amp)
          shake_y = random.randint(-amp, amp)




      state_name = "TUTOR" if state == STATE_TUTOR else ("INFO" if state == STATE_INFO else ("BOSS" if boss is not None and state == STATE_PLAY else ("PLAY" if state == STATE_PLAY else state)))
      draw_ui_bar(screen, font, player, floor, msg, atk_cd, drop_mode, state_name, boss, player_name)




      ox, oy = shake_x, UI_H + shake_y
      draw_world(screen, grid, player, monsters, boss, visible, seen,
                 VIEW_W, VIEW_H, ox, oy,
                 ground_weapons, ground_tickets, treasure_cells, floor)


      if atk_flash > 0:
          draw_attack_overlay(screen, atk_tiles, player, VIEW_W, VIEW_H, ox, oy)




      draw_particles(screen, particles, player, visible, VIEW_W, VIEW_H, ox, oy)
      draw_sniper_warning(screen, sniper_warnings, player, VIEW_W, VIEW_H, ox, oy)
      draw_pet(screen, player, VIEW_W, VIEW_H, ox, oy)
      draw_pet_laser(screen, player, VIEW_W, VIEW_H, ox, oy)




      if state == STATE_INV and (not dead) and (not ending):
          draw_inventory(screen, font, player)




      if state == STATE_SHOP and (not dead) and (not ending):
          draw_shop(screen, font, player, floor, shop_offers or [None]*4, shop_sold or [False]*4, shop_msg)




      if state == STATE_INFO:
          draw_info_screen(screen, font, font_big, info_lock_ms)




      vign = get_hp_vignette_alpha(player)
      draw_hp_vignette(screen, vign)




      if player.hit_flash_ms > 0:
          a = int(140 * (player.hit_flash_ms / HIT_FLASH_MS))
          draw_hit_flash(screen, a)




      if player.is_dashing:
          surf = pygame.Surface((screen.get_width(), screen.get_height()), pygame.SRCALPHA)
          surf.fill((70, 170, 255, 30))
          screen.blit(surf, (0,0))




      if state == STATE_QUIT:
          draw_center_modal(
              screen, font,
              "Return to Start Screen?",
              ["Y: Yes (save score)", "N: No", "", "(Game is paused)"]




          )


      if state == STATE_ADMIN:
          masked = "*" * len(admin_buf)
          draw_center_modal(
              screen, font,
              "ADMIN PASSWORD",
              [admin_msg, "", f"Password: {masked}", "", "ENTER: confirm | ESC: back"]
          )


      if state == STATE_DEAD:
          overlay = pygame.Surface((screen.get_width(), screen.get_height()), pygame.SRCALPHA)
          overlay.fill((0,0,0,220))
          screen.blit(overlay, (0,0))
          draw_text(screen, font_huge, "GAME OVER", screen.get_width()//2 - 210, screen.get_height()//2 - 170, (255,210,180))
          draw_text(screen, font_big, f"FINAL SCORE: {player.score}", screen.get_width()//2 - 280, screen.get_height()//2 - 70, (230,230,240))
          draw_text(screen, font, "ENTER: Restart | ESC: Start Screen", screen.get_width()//2 - 190, screen.get_height()//2 + 10, (230,230,240))




      if state == STATE_END:
          overlay = pygame.Surface((screen.get_width(), screen.get_height()), pygame.SRCALPHA)
          overlay.fill((0,0,0,230))
          screen.blit(overlay, (0,0))
          final_score = int(player.score * ENDING_MULT)
          draw_text(screen, font_huge, "BOSS DEFEATED", screen.get_width()//2 - 270, 110, (200,220,255))
          draw_text(screen, font_big, f"FINAL SCORE: {final_score}", screen.get_width()//2 - 330, 210, (255,220,140))
          draw_text(screen, font, "ENTER: Restart | ESC: Start Screen", screen.get_width()//2 - 190, 280, (230,230,240))




      pygame.display.flip()




# =========================
# Debug start options
# =========================
DEBUG_START_FLOOR = 1
DEBUG_LUCK = 0.25
DEBUG_MEGA_PACKAGE = False




if __name__ == "__main__":
  main(DEBUG_START_FLOOR, luck=DEBUG_LUCK, mega_package=DEBUG_MEGA_PACKAGE)


