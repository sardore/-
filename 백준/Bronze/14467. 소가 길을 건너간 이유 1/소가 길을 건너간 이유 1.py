N = int(input())
locations = [-1] * 11
answer = 0 
for _ in range(N) :
    idx, loc = map(int, input().split())
    if locations[idx] == -1 :    #첫 관찰
        locations[idx] = loc
    elif locations[idx] != loc : #위치 바뀜
        answer += 1
        locations[idx] = loc
print(answer)