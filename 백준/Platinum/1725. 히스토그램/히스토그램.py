import sys

num_bars = int(sys.stdin.readline())
heights = [int(sys.stdin.readline()) for _ in range(num_bars)]

stack = []
max_area = 0

for current_index in range(num_bars):
    start_index = current_index
    while stack and stack[-1][1] > heights[current_index]:
        start_index, height = stack.pop()
        area = (current_index - start_index) * height
        max_area = max(max_area, area)
    stack.append([start_index, heights[current_index]])

while stack:
    start_index, height = stack.pop()
    area = (num_bars - start_index) * height
    max_area = max(max_area, area)

print(max_area)
