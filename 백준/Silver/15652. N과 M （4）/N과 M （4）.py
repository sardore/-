from itertools import combinations_with_replacement
n,m=map(int,input().split())
a=[b for b in range(1,n+1)]
for b in combinations_with_replacement(a,m):#중복있음, 순?서나옴, a에서 m개 고름.
    print(*b)#print속의 *는 리스트나 문자열 등의 각각의 요소를 공백으로 구분해주는 편리한 기능