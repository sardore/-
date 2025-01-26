sugar_delivery = [-1] * 5001
a = int(input())
for n in range(1, 5001):
    min_bags = float('inf')
    for five_kg_bags in range(n // 5 + 1):
        remaining = n - five_kg_bags * 5
        if remaining % 3 == 0:
            three_kg_bags = remaining // 3
            total_bags = five_kg_bags + three_kg_bags
            min_bags = min(min_bags, total_bags)

    if min_bags == float('inf'):
        sugar_delivery[n] = -1
    else:
        sugar_delivery[n] = min_bags


print(sugar_delivery[a])